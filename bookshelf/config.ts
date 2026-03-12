import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import type { SiteConfig } from './types'

export function loadSiteConfig(configPath = path.resolve(process.cwd(), 'config.yml')): SiteConfig {
  const content = fs.readFileSync(configPath, 'utf-8')
  const parsed = YAML.parse(content) as Partial<SiteConfig> | null

  if (!parsed || !Array.isArray(parsed.site_urls)) {
    throw new Error('config.yml must contain a site_urls array')
  }

  const siteUrls = parsed.site_urls
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)

  if (siteUrls.length === 0) {
    throw new Error('config.yml site_urls is empty')
  }

  return { site_urls: siteUrls }
}
