const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' '
}

export function stripHtml(input: string): string {
  const withoutTags = input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

  const decoded = withoutTags.replace(/&[a-zA-Z0-9#]+;/g, (entity) => ENTITY_MAP[entity] ?? entity)

  return decoded.replace(/\s+/g, ' ').trim()
}

export function makeSnippet(text: string, query: string, maxLength = 180): string {
  if (!text) {
    return ''
  }

  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  const lowerText = normalized.toLowerCase()
  const lowerQuery = query.trim().toLowerCase()
  const index = lowerQuery ? lowerText.indexOf(lowerQuery) : -1

  if (index === -1) {
    return `${normalized.slice(0, maxLength)}...`
  }

  const half = Math.floor(maxLength / 2)
  const start = Math.max(0, index - half)
  const end = Math.min(normalized.length, start + maxLength)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < normalized.length ? '...' : ''

  return `${prefix}${normalized.slice(start, end)}${suffix}`
}
