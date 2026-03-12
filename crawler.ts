import { crawlConfiguredSites } from './bookshelf/crawler'

async function main() {
  const summary = await crawlConfiguredSites()

  console.log('Crawl complete')
  console.log(`Sites: ${summary.successSites}/${summary.totalSites} succeeded`)
  console.log(`Documents indexed: ${summary.totalDocuments}`)

  for (const result of summary.results) {
    if (result.ok) {
      console.log(`- OK ${result.searchIndexUrl} (${result.crawledCount} docs)`)
    } else {
      console.log(`- FAIL ${result.searchIndexUrl}: ${result.error}`)
    }
  }

  if (summary.failedSites > 0) {
    console.warn(`Warning: ${summary.failedSites} site(s) failed during this run.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
