import type { CSSProperties, ReactNode } from 'react'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'

export interface BacklogRowColumnBlock {
  id: string
  label: string
  widthClassName?: string
  align?: 'left' | 'center' | 'right'
  showForTypes?: NodeRecord['type'][]
  render: (node: NodeRecord) => ReactNode
}

export const BACKLOG_COLUMN_WIDTH_SCALE_CSS_VAR_BLOCK = '--backlog-column-width-scale'

function parseTailwindScaledWidthTokenBlock(raw: string): string | null {
  const token = raw.trim()
  if (!token) return null

  if (token === 'px') return '1px'
  if (token === 'full') return '100%'
  if (token === 'screen') return '100vw'
  if (token === 'auto') return 'auto'
  if (token === 'min') return 'min-content'
  if (token === 'max') return 'max-content'
  if (token === 'fit') return 'fit-content'

  const fractionMatch = token.match(/^(\d+)\/(\d+)$/)
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1])
    const denominator = Number(fractionMatch[2])
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return `${(numerator / denominator) * 100}%`
    }
  }

  const numericMatch = token.match(/^\d+(?:\.\d+)?$/)
  if (numericMatch) {
    const value = Number(token)
    if (Number.isFinite(value)) return `${value * 0.25}rem`
  }

  return null
}

function parseClassWidthValueBlock(className: string | undefined, prefix: 'w-' | 'min-w-' | 'max-w-'): string | null {
  if (!className) return null
  const tokens = className.split(/\s+/).map(token => token.trim()).filter(Boolean)

  for (const token of tokens) {
    if (!token.startsWith(prefix)) continue
    const suffix = token.slice(prefix.length)
    const bracketMatch = suffix.match(/^\[(.+)\]$/)
    if (bracketMatch) return bracketMatch[1].trim()
    const parsed = parseTailwindScaledWidthTokenBlock(suffix)
    if (parsed) return parsed
  }
  return null
}

function scaleWidthValueBlock(widthValue: string, cssVarName: string): string {
  return widthValue === 'auto'
    ? widthValue
    : `calc(${widthValue} * var(${cssVarName}, 1))`
}

export function scaledWidthStyleFromClassBlock(
  className: string | undefined,
  cssVarName = BACKLOG_COLUMN_WIDTH_SCALE_CSS_VAR_BLOCK,
): CSSProperties | undefined {
  const widthValue = parseClassWidthValueBlock(className, 'w-')
  const minWidthValue = parseClassWidthValueBlock(className, 'min-w-')
  const maxWidthValue = parseClassWidthValueBlock(className, 'max-w-')
  const style: CSSProperties = {}

  if (widthValue) style.width = scaleWidthValueBlock(widthValue, cssVarName)
  if (minWidthValue) style.minWidth = scaleWidthValueBlock(minWidthValue, cssVarName)
  if (maxWidthValue) style.maxWidth = scaleWidthValueBlock(maxWidthValue, cssVarName)

  return Object.keys(style).length > 0 ? style : undefined
}
