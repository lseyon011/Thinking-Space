// Per-project color palette for Claude activity charts.
// Same color for the same project everywhere (chips, heatmap tint, stacked
// area, sparkline) so the eye learns the mapping over time.
//
// A user-defined color (Settings ▸ AI Activity) takes precedence; everything
// else gets a stable hash-assigned color from the anonymous palette below —
// no project names are hardcoded here.

import { resolveProjectColorOverrideBlock } from '@/services/lego_blocks/units/aiActivityMappingBlock'

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

function paletteEntry(r: number, g: number, b: number): ProjectColorEntry {
  return {
    stroke: `rgb(${r},${g},${b})`,
    fill: `rgba(${r},${g},${b},0.45)`,
    chipBg: `rgba(${r},${g},${b},0.15)`,
    dot: `rgba(${r},${g},${b},0.6)`,
  }
}

const PALETTE: ReadonlyArray<ProjectColorEntry> = [
  paletteEntry(56, 189, 248), // sky
  paletteEntry(52, 211, 153), // emerald
  paletteEntry(167, 139, 250), // violet
  paletteEntry(251, 191, 36), // amber
  paletteEntry(251, 113, 133), // rose
  paletteEntry(232, 121, 249), // fuchsia
  paletteEntry(251, 146, 60), // orange
  paletteEntry(45, 212, 191), // teal
  paletteEntry(129, 140, 248), // indigo
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

// Dusty mauve — visible against the grey empty-cell background while still
// reading as a "noise / background activity" bucket (auto-commits, telegram
// pings, etc.). Previously a stone-grey that blended into empty cells.
const NOISE_ENTRY: ProjectColorEntry = {
  stroke: 'rgb(190,130,160)',
  fill: 'rgba(190,130,160,0.40)',
  chipBg: 'rgba(190,130,160,0.15)',
  dot: 'rgba(190,130,160,0.55)',
}

/** Parse `#rrggbb` into [r,g,b]; returns null if not a 6-digit hex. */
function hexToRgb(hex: string): [number, number, number] | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/** Build a full ProjectColorEntry from a single hex, matching the opacity
 *  ramps used by the hand-picked palette so user colors read identically. */
function entryFromHex(hex: string): ProjectColorEntry | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb
  return {
    stroke: `rgb(${r},${g},${b})`,
    fill: `rgba(${r},${g},${b},0.45)`,
    chipBg: `rgba(${r},${g},${b},0.15)`,
    dot: `rgba(${r},${g},${b},0.6)`,
  }
}

export function getProjectColor(name: string): ProjectColorEntry {
  // User override wins over everything (including noise/unknown buckets).
  const override = resolveProjectColorOverrideBlock(name)
  if (override) {
    const entry = entryFromHex(override)
    if (entry) return entry
  }
  if (name.startsWith('[') && name.endsWith(']')) return NOISE_ENTRY
  if (name === '<unknown>') return UNKNOWN_ENTRY
  // Stable hash so the same project always gets the same palette slot.
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
