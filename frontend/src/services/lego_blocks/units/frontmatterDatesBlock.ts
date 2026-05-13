import { parseFrontmatterObject, splitFrontmatter } from '@/components/lego_blocks/units/MarkdownDocumentContentBlock'

/* Resolve a markdown note's "created" / "updated" timestamps.

   On networked / cloud-mirrored filesystems (iCloud Drive, Dropbox, etc.) the
   OS-reported birthtime and mtime are often identical because the local mirror
   was downloaded at one point in time. YAML frontmatter (`created_at`,
   `updated_at`, etc.) is therefore preferred over fs stats when present.

   Returns Date instances; falls back to fs ctime/mtime (in seconds since
   epoch) when the frontmatter doesn't carry the field. */

const CREATED_KEYS = ['created_at', 'created', 'date_created', 'createdAt', 'creation_date', 'date']
const UPDATED_KEYS = ['updated_at', 'updated', 'last_modified', 'modified', 'date_modified', 'updatedAt']

function coerceToDateValue(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    // Heuristic: seconds vs ms.
    const ms = value > 10_000_000_000 ? value : value * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const d = new Date(trimmed)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function firstDateFromKeys(record: Record<string, unknown>, keys: string[]): Date | null {
  for (const key of keys) {
    if (key in record) {
      const d = coerceToDateValue(record[key])
      if (d) return d
    }
  }
  return null
}

export interface FrontmatterDates {
  created: Date | null
  updated: Date | null
}

export function resolveFrontmatterDatesBlock(
  content: string,
  fallback: { ctimeSeconds?: number | null; mtimeSeconds?: number | null } = {},
): FrontmatterDates {
  const { frontmatter } = splitFrontmatter(content)
  const fields = frontmatter ? parseFrontmatterObject(frontmatter) : {}

  const createdFromYaml = firstDateFromKeys(fields, CREATED_KEYS)
  const updatedFromYaml = firstDateFromKeys(fields, UPDATED_KEYS)

  const created = createdFromYaml
    ?? (fallback.ctimeSeconds != null ? new Date(fallback.ctimeSeconds * 1000) : null)
  const updated = updatedFromYaml
    ?? (fallback.mtimeSeconds != null ? new Date(fallback.mtimeSeconds * 1000) : null)

  return { created, updated }
}
