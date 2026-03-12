export type SearchField = 'title' | 'content'

export interface SiteConfig {
  site_urls: string[]
}

export interface CrawledDocument {
  location: string
  title: string
  textHtml: string
  textPlain: string
  url: string
}

export interface CrawledSite {
  searchIndexUrl: string
  baseUrl: string
  siteName: string
  documents: CrawledDocument[]
}

export interface CrawlSiteResult {
  searchIndexUrl: string
  ok: boolean
  siteName?: string
  crawledCount?: number
  error?: string
}

export interface CrawlSummary {
  totalSites: number
  successSites: number
  failedSites: number
  totalDocuments: number
  results: CrawlSiteResult[]
}

export interface SiteStatusRow {
  searchIndexUrl: string
  baseUrl: string | null
  name: string | null
  lastCrawledAt: string | null
  status: string | null
  errorMessage: string | null
  documentCount: number
}

export interface SearchRow {
  id: number
  title: string
  titleHighlighted: string
  textPlain: string
  snippet: string
  snippetHighlighted: string
  url: string
  location: string
  siteName: string
  siteBaseUrl: string
  score: number
}

export interface SearchResult {
  total: number
  rows: SearchRow[]
}
