export function normalizeTagBlock(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeTagListBlock(tags: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const tag of tags) {
    const next = normalizeTagBlock(tag)
    if (!next) continue
    const dedupeKey = next.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    normalized.push(next)
  }
  return normalized
}

export function splitTagInputBlock(value: string): string[] {
  return normalizeTagListBlock(
    value
      .split(/[,\n]/)
      .map(segment => segment.trim())
      .filter(Boolean),
  )
}

export function hasTagBlock(tags: string[], tag: string): boolean {
  const lookup = normalizeTagBlock(tag).toLowerCase()
  if (!lookup) return false
  return tags.some(item => normalizeTagBlock(item).toLowerCase() === lookup)
}

export function tagsEqualBlock(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    if (normalizeTagBlock(a[index]).toLowerCase() !== normalizeTagBlock(b[index]).toLowerCase()) return false
  }
  return true
}
