import express from 'express'
import cors from 'cors'
import { crawlConfiguredSites } from './bookshelf/crawler'
import { NotebookShelfDB } from './bookshelf/database'
import { loadSiteConfig } from './bookshelf/config'
import type { SearchField } from './bookshelf/types'

const app = express()
const port = Number(process.env.PORT ?? 8787)
const crawlIntervalMinutes = Number(process.env.CRAWL_INTERVAL_MINUTES ?? 60)

const crawlRuntimeState = {
	isCrawling: false,
	startedAt: null as string | null,
	currentSite: null as string | null,
	inProgressSites: new Set<string>()
}

app.use(cors())
app.use(express.json())
app.use((req, res, next) => {
	const startedAt = Date.now()
	console.log(`[req] ${req.method} ${req.originalUrl}`)

	res.on('finish', () => {
		const duration = Date.now() - startedAt
		console.log(`[res] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`)
	})

	next()
})

app.get('/api/health', (_req, res) => {
	const db = new NotebookShelfDB()
	const stats = db.getStats()
	db.close()

	res.json({
		ok: true,
		...stats
	})
})

app.post('/api/crawl', async (_req, res) => {
	if (crawlRuntimeState.isCrawling) {
		return res.status(409).json({
			message: 'crawl is already running'
		})
	}

	try {
		const summary = await executeCrawl('manual')
		res.json(summary)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		res.status(500).json({ message })
	}
})

app.get('/api/config', (_req, res) => {
	const config = loadSiteConfig()
	const db = new NotebookShelfDB()
	const persistedRows = db.getSiteStatuses(config.site_urls)
	db.close()

	const persistedByUrl = new Map(persistedRows.map((row) => [row.searchIndexUrl, row]))

	const sites = config.site_urls.map((searchIndexUrl) => {
		const persisted = persistedByUrl.get(searchIndexUrl)
		return {
			searchIndexUrl,
			baseUrl: persisted?.baseUrl ?? null,
			name: persisted?.name ?? null,
			lastCrawledAt: persisted?.lastCrawledAt ?? null,
			status: persisted?.status ?? 'pending',
			errorMessage: persisted?.errorMessage ?? null,
			documentCount: persisted?.documentCount ?? 0,
			inProgress: crawlRuntimeState.inProgressSites.has(searchIndexUrl)
		}
	})

	const successCount = sites.filter((site) => site.status === 'ok').length
	const failedCount = sites.filter((site) => site.status === 'error').length
	const pendingCount = sites.filter((site) => site.status === 'pending').length

	return res.json({
		crawl: {
			isCrawling: crawlRuntimeState.isCrawling,
			startedAt: crawlRuntimeState.startedAt,
			currentSite: crawlRuntimeState.currentSite,
			inProgressCount: crawlRuntimeState.inProgressSites.size
		},
		summary: {
			totalSites: sites.length,
			successSites: successCount,
			failedSites: failedCount,
			pendingSites: pendingCount
		},
		sites
	})
})

app.get('/api/search', (req, res) => {
	const query = String(req.query.q ?? '').trim()
	const field = String(req.query.field ?? 'content') as SearchField
	const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1)
	const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.pageSize ?? '20'), 10) || 20))

	if (!['title', 'content'].includes(field)) {
		return res.status(400).json({ message: 'field must be title or content' })
	}

	if (query.length === 0) {
		return res.json({
			total: 0,
			page,
			pageSize,
			query,
			field,
			results: []
		})
	}

	const db = new NotebookShelfDB()
	const result = db.search(query, field, page, pageSize)
	db.close()

	return res.json({
		total: result.total,
		page,
		pageSize,
		query,
		field,
		results: result.rows.map((row) => ({
			title: row.title,
			titleHighlighted: row.titleHighlighted,
			url: row.url,
			location: row.location,
			siteName: row.siteName,
			siteBaseUrl: row.siteBaseUrl,
			score: row.score,
			snippet: row.snippet,
			snippetHighlighted: row.snippetHighlighted
		}))
	})
})

app.listen(port, () => {
	console.log(`NotebookShelf API listening on http://localhost:${port}`)
})

async function executeCrawl(reason: 'startup' | 'schedule' | 'manual') {
	if (crawlRuntimeState.isCrawling) {
		throw new Error('crawl is already running')
	}

	crawlRuntimeState.isCrawling = true
	crawlRuntimeState.startedAt = new Date().toISOString()
	crawlRuntimeState.currentSite = null
	crawlRuntimeState.inProgressSites.clear()

	try {
		const summary = await crawlConfiguredSites({
			onSiteStart(searchIndexUrl) {
				crawlRuntimeState.currentSite = searchIndexUrl
				crawlRuntimeState.inProgressSites.add(searchIndexUrl)
			},
			onSiteFinish(searchIndexUrl) {
				crawlRuntimeState.inProgressSites.delete(searchIndexUrl)
				if (crawlRuntimeState.currentSite === searchIndexUrl) {
					crawlRuntimeState.currentSite = null
				}
			}
		})

		return summary
	} finally {
		crawlRuntimeState.isCrawling = false
		crawlRuntimeState.currentSite = null
		crawlRuntimeState.inProgressSites.clear()
	}
}

async function runCrawlJob(reason: 'startup' | 'schedule') {
	const startedAt = new Date().toISOString()
	console.log(`[crawl:${reason}] started at ${startedAt}`)
	try {
		if (crawlRuntimeState.isCrawling) {
			console.log(`[crawl:${reason}] skipped because another crawl is running`)
			return
		}

		const summary = await executeCrawl(reason)
		console.log(
			`[crawl:${reason}] done: ${summary.successSites}/${summary.totalSites} sites, ${summary.totalDocuments} docs`
		)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`[crawl:${reason}] failed: ${message}`)
	}
}

void runCrawlJob('startup')

if (crawlIntervalMinutes > 0) {
	setInterval(() => {
		void runCrawlJob('schedule')
	}, crawlIntervalMinutes * 60 * 1000)
}
