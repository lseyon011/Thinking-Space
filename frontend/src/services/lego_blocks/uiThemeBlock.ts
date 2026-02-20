export type UIThemeId = 'classic' | 'modern-classic' | 'modern'

export interface UIThemeOptionBlock {
  id: UIThemeId
  label: string
  description: string
}

export const DEFAULT_UI_THEME_ID_BLOCK: UIThemeId = 'classic'

export const UI_THEME_OPTIONS_BLOCK: readonly UIThemeOptionBlock[] = Object.freeze([
  {
    id: 'classic',
    label: 'Classic',
    description: 'Current Thinking Space visual language.',
  },
  {
    id: 'modern-classic',
    label: 'Modern Classic',
    description: 'Balanced native glass styling inspired by Cupertino.',
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Full modern Cupertino treatment with stronger surfaces.',
  },
])

const VALID_THEME_IDS = new Set<UIThemeId>(UI_THEME_OPTIONS_BLOCK.map(option => option.id))

export function isUIThemeIdBlock(value: unknown): value is UIThemeId {
  return typeof value === 'string' && VALID_THEME_IDS.has(value as UIThemeId)
}

export function normalizeUIThemeIdBlock(value: unknown): UIThemeId {
  if (isUIThemeIdBlock(value)) return value
  return DEFAULT_UI_THEME_ID_BLOCK
}
