import { loadSiteConfig } from './config'
import { NotebookShelfDB } from './database.js'
import { stripHtml } from './text'
import type { CrawledSite, CrawlSummary } from './types'

export interface CrawlHooks {
  onSiteStart?: (searchIndexUrl: string) => void
  onSiteFinish?: (searchIndexUrl: string, ok: boolean) => void
}

interface MkdocsSearchDoc {
  location?: string
  title?: string
  text?: string
}

interface MkdocsSearchIndex {
  docs?: MkdocsSearchDoc[]
}

function deriveSiteBaseUrl(searchIndexUrl: string): string {
  const parsed = new URL(searchIndexUrl)
  const marker = '/search_index.json'

  if (parsed.pathname.endsWith(marker)) {
    let basePath = parsed.pathname.slice(0, -marker.length)
    if (basePath.endsWith('/search')) {
      basePath = basePath.slice(0, -'/search'.length)
    }

    parsed.pathname = basePath || '/'
  }

  parsed.search = ''
  parsed.hash = ''

  return parsed.toString().replace(/\/$/, '')
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

function docToAbsoluteUrl(baseUrl: string, location: string): string {
  return new URL(location || '.', ensureTrailingSlash(baseUrl)).toString()
}

async function fetchSearchIndex(searchIndexUrl: string): Promise<MkdocsSearchIndex> {
  const response = await fetch(searchIndexUrl, {
    signal: AbortSignal.timeout(20_000)
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${searchIndexUrl}: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as MkdocsSearchIndex
}

function normalizeSiteName(baseUrl: string): string {
  try {
    const host = new URL(baseUrl).hostname
    return host.replace(/^www\./, '')
  } catch {
    return baseUrl
  }
}

export async function crawlConfiguredSites(hooks?: CrawlHooks) {
  const db = new NotebookShelfDB()
  const config = loadSiteConfig()

  const summary: CrawlSummary = {
    totalSites: config.site_urls.length,
    successSites: 0,
    failedSites: 0,
    totalDocuments: 0,
    results: []
  }

  for (const searchIndexUrl of config.site_urls) {
    hooks?.onSiteStart?.(searchIndexUrl)
    try {
      const searchIndex = await fetchSearchIndex(searchIndexUrl)
      const baseUrl = deriveSiteBaseUrl(searchIndexUrl)
      const siteName = normalizeSiteName(baseUrl)

      const docs = Array.isArray(searchIndex.docs) ? searchIndex.docs : []
      const normalizedDocs = docs.map((doc) => {
        const location = String(doc.location ?? '').trim()
        const title = String(doc.title ?? '').trim() || '(untitled)'
        const textHtml = String(doc.text ?? '')

        return {
          location,
          title,
          textHtml,
          textPlain: stripHtml(textHtml),
          url: docToAbsoluteUrl(baseUrl, location)
        }
      })

      const payload: CrawledSite = {
        searchIndexUrl,
        baseUrl,
        siteName,
        documents: normalizedDocs
      }

      db.saveCrawledSite(payload)

      summary.successSites += 1
      summary.totalDocuments += normalizedDocs.length
      summary.results.push({
        searchIndexUrl,
        ok: true,
        siteName,
        crawledCount: normalizedDocs.length
      })
      hooks?.onSiteFinish?.(searchIndexUrl, true)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      db.markSiteFailure(searchIndexUrl, message)

      summary.failedSites += 1
      summary.results.push({
        searchIndexUrl,
        ok: false,
        error: message
      })
      hooks?.onSiteFinish?.(searchIndexUrl, false)
    }
  }

  db.rebuildFtsIndex()
  db.close()

  return summary
}
