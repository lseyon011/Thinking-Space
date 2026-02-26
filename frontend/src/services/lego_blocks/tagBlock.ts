export function normalizeTagBlock(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

const TAG_COLOR_PALETTE_BLOCK = [
  {
    solid: 'border-emerald-200/80 bg-emerald-100/75 text-emerald-800',
    subtle: 'border-emerald-200/70 bg-emerald-50/70 text-emerald-800/80',
    selected: 'border-emerald-300 bg-emerald-100/80 text-emerald-800',
    unselected: 'border-emerald-200/80 text-emerald-700/70 hover:bg-emerald-50/60',
  },
  {
    solid: 'border-sky-200/80 bg-sky-100/75 text-sky-800',
    subtle: 'border-sky-200/70 bg-sky-50/70 text-sky-800/80',
    selected: 'border-sky-300 bg-sky-100/80 text-sky-800',
    unselected: 'border-sky-200/80 text-sky-700/70 hover:bg-sky-50/60',
  },
  {
    solid: 'border-amber-200/80 bg-amber-100/75 text-amber-800',
    subtle: 'border-amber-200/70 bg-amber-50/70 text-amber-800/80',
    selected: 'border-amber-300 bg-amber-100/80 text-amber-800',
    unselected: 'border-amber-200/80 text-amber-700/70 hover:bg-amber-50/60',
  },
  {
    solid: 'border-rose-200/80 bg-rose-100/75 text-rose-800',
    subtle: 'border-rose-200/70 bg-rose-50/70 text-rose-800/80',
    selected: 'border-rose-300 bg-rose-100/80 text-rose-800',
    unselected: 'border-rose-200/80 text-rose-700/70 hover:bg-rose-50/60',
  },
  {
    solid: 'border-violet-200/80 bg-violet-100/75 text-violet-800',
    subtle: 'border-violet-200/70 bg-violet-50/70 text-violet-800/80',
    selected: 'border-violet-300 bg-violet-100/80 text-violet-800',
    unselected: 'border-violet-200/80 text-violet-700/70 hover:bg-violet-50/60',
  },
  {
    solid: 'border-cyan-200/80 bg-cyan-100/75 text-cyan-800',
    subtle: 'border-cyan-200/70 bg-cyan-50/70 text-cyan-800/80',
    selected: 'border-cyan-300 bg-cyan-100/80 text-cyan-800',
    unselected: 'border-cyan-200/80 text-cyan-700/70 hover:bg-cyan-50/60',
  },
] as const

export type TagColorVariantBlock = 'solid' | 'subtle' | 'selected' | 'unselected'
export type TagColorPaletteEntryBlock = (typeof TAG_COLOR_PALETTE_BLOCK)[number]

const TAG_COLOR_FALLBACK_BY_VARIANT: Record<TagColorVariantBlock, { bgAlpha: number; borderAlpha: number; textAlpha: number }> = {
  solid: { bgAlpha: 0.2, borderAlpha: 0.46, textAlpha: 1 },
  subtle: { bgAlpha: 0.1, borderAlpha: 0.34, textAlpha: 0.9 },
  selected: { bgAlpha: 0.24, borderAlpha: 0.52, textAlpha: 1 },
  unselected: { bgAlpha: 0.04, borderAlpha: 0.3, textAlpha: 0.82 },
}

type RGB = { r: number; g: number; b: number }

function hashTagBlock(tag: string): number {
  const normalized = normalizeTagBlock(tag)
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(index)
    hash |= 0
  }
  return hash
}

export function tagPaletteBlock(tag: string): TagColorPaletteEntryBlock {
  const paletteIndex = Math.abs(hashTagBlock(tag)) % TAG_COLOR_PALETTE_BLOCK.length
  return TAG_COLOR_PALETTE_BLOCK[paletteIndex]
}

export function tagLookupKeyBlock(tag: string): string {
  return normalizeTagBlock(tag).toLowerCase()
}

export function normalizeHexColorBlock(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const compact = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  if (/^[0-9a-fA-F]{3}$/.test(compact)) {
    const [r, g, b] = compact.split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(compact)) return `#${compact}`.toLowerCase()
  return null
}

function parseHexRgbBlock(value: string): RGB {
  const compact = value.slice(1)
  const r = Number.parseInt(compact.slice(0, 2), 16)
  const g = Number.parseInt(compact.slice(2, 4), 16)
  const b = Number.parseInt(compact.slice(4, 6), 16)
  return { r, g, b }
}

function rgbaBlock(rgb: RGB, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha))
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`
}

function relativeLuminanceBlock(rgb: RGB): number {
  const linear = (channel: number) => {
    const value = channel / 255
    if (value <= 0.03928) return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4
  }
  return (0.2126 * linear(rgb.r)) + (0.7152 * linear(rgb.g)) + (0.0722 * linear(rgb.b))
}

function textColorBlock(rgb: RGB, alpha: number): string {
  const luminance = relativeLuminanceBlock(rgb)
  const base = luminance > 0.48 ? { r: 15, g: 23, b: 42 } : { r: 248, g: 250, b: 252 }
  return rgbaBlock(base, alpha)
}

export function tagColorClassBlock(tag: string, variant: TagColorVariantBlock = 'solid'): string {
  return tagPaletteBlock(tag)[variant]
}

export function tagColorStyleBlock(
  _tag: string,
  variant: TagColorVariantBlock = 'solid',
  customHexColor?: string | null,
): Record<string, string> | undefined {
  const normalized = normalizeHexColorBlock(customHexColor)
  if (!normalized) return undefined
  const rgb = parseHexRgbBlock(normalized)
  const tone = TAG_COLOR_FALLBACK_BY_VARIANT[variant]
  return {
    backgroundColor: rgbaBlock(rgb, tone.bgAlpha),
    borderColor: rgbaBlock(rgb, tone.borderAlpha),
    color: textColorBlock(rgb, tone.textAlpha),
  }
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
