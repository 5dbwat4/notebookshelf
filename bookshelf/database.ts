import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { makeSnippet } from './text'
import type { CrawledSite, SearchField, SearchResult, SearchRow, SiteStatusRow } from './types'

export const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'bookshelf', 'data', 'bookshelf.db')

function normalizeQueryToTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter((word) => word.length > 0)
}

function buildFtsMatchQuery(query: string, field: SearchField): string {
  const tokens = normalizeQueryToTokens(query)
  if (tokens.length === 0) {
    return ''
  }

  const target = field === 'title' ? 'title' : 'text_plain'
  return tokens.map((token) => `${target}:${token}*`).join(' AND ')
}

interface DbSearchRow {
  id: number
  title: string
  textPlain: string
  url: string
  location: string
  siteName: string
  siteBaseUrl: string
  score: number
  titleMarked: string
  snippetMarked: string
}

export class NotebookShelfDB {
  private readonly db: Database.Database

  constructor(dbPath = DEFAULT_DB_PATH) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initSchema()
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_index_url TEXT NOT NULL UNIQUE,
        base_url TEXT NOT NULL,
        name TEXT NOT NULL,
        last_crawled_at TEXT,
        status TEXT,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL,
        location TEXT NOT NULL,
        title TEXT NOT NULL,
        text_html TEXT NOT NULL,
        text_plain TEXT NOT NULL,
        url TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_id, location),
        FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        doc_id UNINDEXED,
        title,
        text_plain,
        site_name,
        url,
        tokenize = 'unicode61'
      );

      CREATE INDEX IF NOT EXISTS idx_documents_site_id ON documents(site_id);
      CREATE INDEX IF NOT EXISTS idx_sites_search_index_url ON sites(search_index_url);
    `)
  }

  private upsertSite(searchIndexUrl: string, baseUrl: string, siteName: string): number {
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO sites (search_index_url, base_url, name, last_crawled_at, status, error_message)
        VALUES (@searchIndexUrl, @baseUrl, @siteName, @now, 'ok', NULL)
        ON CONFLICT(search_index_url)
        DO UPDATE SET
          base_url = excluded.base_url,
          name = excluded.name,
          last_crawled_at = excluded.last_crawled_at,
          status = 'ok',
          error_message = NULL
      `
      )
      .run({ searchIndexUrl, baseUrl, siteName, now })

    const row = this.db.prepare('SELECT id FROM sites WHERE search_index_url = ?').get(searchIndexUrl) as { id: number }
    return row.id
  }

  markSiteFailure(searchIndexUrl: string, errorMessage: string) {
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO sites (search_index_url, base_url, name, last_crawled_at, status, error_message)
        VALUES (@searchIndexUrl, @searchIndexUrl, @searchIndexUrl, @now, 'error', @errorMessage)
        ON CONFLICT(search_index_url)
        DO UPDATE SET
          last_crawled_at = excluded.last_crawled_at,
          status = 'error',
          error_message = excluded.error_message
      `
      )
      .run({ searchIndexUrl, now, errorMessage })
  }

  saveCrawledSite(site: CrawledSite) {
    const tx = this.db.transaction((payload: CrawledSite) => {
      const siteId = this.upsertSite(payload.searchIndexUrl, payload.baseUrl, payload.siteName)
      this.db.prepare('DELETE FROM documents WHERE site_id = ?').run(siteId)

      const now = new Date().toISOString()
      const insertDoc = this.db.prepare(
        `
        INSERT INTO documents (site_id, location, title, text_html, text_plain, url, updated_at)
        VALUES (@siteId, @location, @title, @textHtml, @textPlain, @url, @now)
      `
      )

      for (const doc of payload.documents) {
        insertDoc.run({
          siteId,
          location: doc.location,
          title: doc.title,
          textHtml: doc.textHtml,
          textPlain: doc.textPlain,
          url: doc.url,
          now
        })
      }
    })

    tx(site)
  }

  rebuildFtsIndex() {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM documents_fts').run()

      this.db.exec(`
        INSERT INTO documents_fts (doc_id, title, text_plain, site_name, url)
        SELECT d.id, d.title, d.text_plain, s.name, d.url
        FROM documents d
        INNER JOIN sites s ON s.id = d.site_id;
      `)
    })

    tx()
  }

  search(query: string, field: SearchField, page = 1, pageSize = 20): SearchResult {
    const match = buildFtsMatchQuery(query, field)
    if (!match) {
      return { total: 0, rows: [] }
    }

    const offset = (page - 1) * pageSize

    const total = (
      this.db.prepare('SELECT COUNT(*) AS count FROM documents_fts WHERE documents_fts MATCH ?').get(match) as {
        count: number
      }
    ).count

    const rows = this.db
      .prepare(
        `
        SELECT
          d.id AS id,
          d.title AS title,
          d.text_plain AS textPlain,
          d.url AS url,
          d.location AS location,
          s.name AS siteName,
          s.base_url AS siteBaseUrl,
          bm25(documents_fts, 0.0, 1.6, 0.3, 0.1, 0.1) AS score,
          highlight(documents_fts, 1, '<mark>', '</mark>') AS titleMarked,
          snippet(documents_fts, 2, '<mark>', '</mark>', ' ... ', 22) AS snippetMarked
        FROM documents_fts
        INNER JOIN documents d ON d.id = CAST(documents_fts.doc_id AS INTEGER)
        INNER JOIN sites s ON s.id = d.site_id
        WHERE documents_fts MATCH ?
        ORDER BY score ASC
        LIMIT ? OFFSET ?
      `
      )
      .all(match, pageSize, offset) as DbSearchRow[]

    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        title: row.title,
        titleHighlighted: row.titleMarked,
        textPlain: row.textPlain,
        snippet: row.snippetMarked || makeSnippet(row.textPlain, query),
        snippetHighlighted: row.snippetMarked || makeSnippet(row.textPlain, query),
        url: row.url,
        location: row.location,
        siteName: row.siteName,
        siteBaseUrl: row.siteBaseUrl,
        score: row.score
      }))
    }
  }

  getStats() {
    const siteCount = (this.db.prepare('SELECT COUNT(*) AS count FROM sites').get() as { count: number }).count
    const docCount = (this.db.prepare('SELECT COUNT(*) AS count FROM documents').get() as { count: number }).count

    return { siteCount, docCount }
  }

  getSiteStatuses(searchIndexUrls: string[]): SiteStatusRow[] {
    if (searchIndexUrls.length === 0) {
      return []
    }

    const placeholders = searchIndexUrls.map(() => '?').join(', ')
    const rows = this.db
      .prepare(
        `
        SELECT
          s.search_index_url AS searchIndexUrl,
          s.base_url AS baseUrl,
          s.name AS name,
          s.last_crawled_at AS lastCrawledAt,
          s.status AS status,
          s.error_message AS errorMessage,
          COUNT(d.id) AS documentCount
        FROM sites s
        LEFT JOIN documents d ON d.site_id = s.id
        WHERE s.search_index_url IN (${placeholders})
        GROUP BY s.id
      `
      )
      .all(...searchIndexUrls) as SiteStatusRow[]

    return rows
  }

  close() {
    this.db.close()
  }
}
