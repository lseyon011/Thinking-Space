export type PostItColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange'

export const POST_IT_COLORS: PostItColor[] = ['yellow', 'pink', 'blue', 'green', 'orange']

export const DEFAULT_POST_IT_COLOR: PostItColor = 'yellow'

export interface PostItPaletteEntry {
  background: string
  text: string
  textMuted: string
  cornerMark: string
  border: string
  borderFocused: string
  shadow: string
  shadowFocused: string
}

export const POST_IT_PALETTE: Record<PostItColor, PostItPaletteEntry> = {
  yellow: {
    background: '#FEF3B0',
    text: '#3a2f00',
    textMuted: 'rgba(58, 47, 0, 0.5)',
    cornerMark: '#d9b800',
    border: 'rgba(0, 0, 0, 0.06)',
    borderFocused: 'rgba(0, 0, 0, 0.2)',
    shadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
    shadowFocused: '0 14px 44px rgba(0, 0, 0, 0.5)',
  },
  pink: {
    background: '#FDD0DC',
    text: '#4a1d2b',
    textMuted: 'rgba(74, 29, 43, 0.5)',
    cornerMark: '#d96a8b',
    border: 'rgba(0, 0, 0, 0.06)',
    borderFocused: 'rgba(0, 0, 0, 0.22)',
    shadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
    shadowFocused: '0 14px 44px rgba(0, 0, 0, 0.5)',
  },
  blue: {
    background: '#C9E4F6',
    text: '#0d2a3a',
    textMuted: 'rgba(13, 42, 58, 0.5)',
    cornerMark: '#4a8bbf',
    border: 'rgba(0, 0, 0, 0.06)',
    borderFocused: 'rgba(0, 0, 0, 0.22)',
    shadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
    shadowFocused: '0 14px 44px rgba(0, 0, 0, 0.5)',
  },
  green: {
    background: '#C8EBC2',
    text: '#143018',
    textMuted: 'rgba(20, 48, 24, 0.5)',
    cornerMark: '#5aa063',
    border: 'rgba(0, 0, 0, 0.06)',
    borderFocused: 'rgba(0, 0, 0, 0.22)',
    shadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
    shadowFocused: '0 14px 44px rgba(0, 0, 0, 0.5)',
  },
  orange: {
    background: '#FED4B0',
    text: '#4a2410',
    textMuted: 'rgba(74, 36, 16, 0.5)',
    cornerMark: '#d97a3c',
    border: 'rgba(0, 0, 0, 0.06)',
    borderFocused: 'rgba(0, 0, 0, 0.22)',
    shadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
    shadowFocused: '0 14px 44px rgba(0, 0, 0, 0.5)',
  },
}
