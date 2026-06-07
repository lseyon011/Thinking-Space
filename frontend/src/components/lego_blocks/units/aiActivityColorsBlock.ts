// Per-project color palette for Claude activity charts.
// Same hand-picked color for the same project everywhere (chips, heatmap tint,
// stacked area, sparkline) so the eye learns the mapping over time.

export interface ProjectColorEntry {
  /** Primary stroke / chip text color. */
  stroke: string
  /** Filled area tint. */
  fill: string
  /** Soft chip background (for active chip). */
  chipBg: string
  /** Subtle muted dot (legend / inactive chip border). */
  dot: string
}

const PALETTE: ReadonlyArray<{ match: (name: string) => boolean; entry: ProjectColorEntry }> = [
  {
    match: n => n === 'Thinking-Space',
    entry: {
      stroke: 'rgb(56,189,248)',
      fill: 'rgba(56,189,248,0.45)',
      chipBg: 'rgba(56,189,248,0.15)',
      dot: 'rgba(56,189,248,0.6)',
    },
  },
  {
    match: n => n === 'LTM/F9',
    entry: {
      stroke: 'rgb(52,211,153)',
      fill: 'rgba(52,211,153,0.45)',
      chipBg: 'rgba(52,211,153,0.15)',
      dot: 'rgba(52,211,153,0.6)',
    },
  },
  {
    match: n => n === 'LTM/sfresearch',
    entry: {
      stroke: 'rgb(167,139,250)',
      fill: 'rgba(167,139,250,0.45)',
      chipBg: 'rgba(167,139,250,0.15)',
      dot: 'rgba(167,139,250,0.6)',
    },
  },
  {
    match: n => n === 'LTM/sfvisa',
    entry: {
      stroke: 'rgb(251,191,36)',
      fill: 'rgba(251,191,36,0.45)',
      chipBg: 'rgba(251,191,36,0.15)',
      dot: 'rgba(251,191,36,0.6)',
    },
  },
  {
    match: n => n === 'LTM/sfbooks',
    entry: {
      stroke: 'rgb(251,113,133)',
      fill: 'rgba(251,113,133,0.45)',
      chipBg: 'rgba(251,113,133,0.15)',
      dot: 'rgba(251,113,133,0.6)',
    },
  },
  {
    match: n => n === 'LTM/sfdl',
    entry: {
      stroke: 'rgb(232,121,249)',
      fill: 'rgba(232,121,249,0.45)',
      chipBg: 'rgba(232,121,249,0.15)',
      dot: 'rgba(232,121,249,0.6)',
    },
  },
  {
    match: n => n === 'LTM/kai-workspace',
    entry: {
      stroke: 'rgb(251,146,60)',
      fill: 'rgba(251,146,60,0.45)',
      chipBg: 'rgba(251,146,60,0.15)',
      dot: 'rgba(251,146,60,0.6)',
    },
  },
  {
    match: n => n === 'LTM/ai_raw',
    entry: {
      stroke: 'rgb(45,212,191)',
      fill: 'rgba(45,212,191,0.45)',
      chipBg: 'rgba(45,212,191,0.15)',
      dot: 'rgba(45,212,191,0.6)',
    },
  },
  {
    match: n => n === 'LTM',
    entry: {
      stroke: 'rgb(148,163,184)',
      fill: 'rgba(148,163,184,0.45)',
      chipBg: 'rgba(148,163,184,0.15)',
      dot: 'rgba(148,163,184,0.6)',
    },
  },
]

// Warm clay/terracotta — distinct from the grey empty-cell background so an
// unknown-project day actually shows up on the heatmap (previously it blended
// in with empty cells because both were grey).
const UNKNOWN_ENTRY: ProjectColorEntry = {
  stroke: 'rgb(217,119,87)',
  fill: 'rgba(217,119,87,0.45)',
  chipBg: 'rgba(217,119,87,0.15)',
  dot: 'rgba(217,119,87,0.6)',
}

const NOISE_ENTRY: ProjectColorEntry = {
  stroke: 'rgb(120,113,108)',
  fill: 'rgba(120,113,108,0.30)',
  chipBg: 'rgba(120,113,108,0.10)',
  dot: 'rgba(120,113,108,0.4)',
}

export function getProjectColor(name: string): ProjectColorEntry {
  if (name.startsWith('[') && name.endsWith(']')) return NOISE_ENTRY
  if (name === '<unknown>') return UNKNOWN_ENTRY
  const found = PALETTE.find(p => p.match(name))
  if (found) return found.entry
  // Stable fallback for unknown project names: hash the name into the PALETTE.
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length].entry
}
