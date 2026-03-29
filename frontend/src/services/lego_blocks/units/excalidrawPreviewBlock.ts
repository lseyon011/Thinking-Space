import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

/**
 * Minimal Excalidraw element types for SVG preview generation.
 */
interface ExcalidrawElement {
  type: string
  x: number
  y: number
  width: number
  height: number
  strokeColor?: string
  backgroundColor?: string
  fillStyle?: string
  strokeWidth?: number
  roughness?: number
  opacity?: number
  text?: string
  fontSize?: number
  points?: [number, number][]
  isDeleted?: boolean
}

interface ExcalidrawScene {
  elements?: ExcalidrawElement[]
  appState?: { viewBackgroundColor?: string }
}

/**
 * Parse an excalidraw file and extract the JSON scene.
 * Handles both pure .excalidraw (JSON) and .excalidraw.md (Obsidian plugin format).
 */
function parseExcalidrawScene(content: string): ExcalidrawScene | null {
  // Pure JSON format
  const trimmed = content.trimStart()
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return null
    }
  }

  // Obsidian Excalidraw plugin format — JSON block is in a code fence
  const jsonBlockMatch = content.match(/```json\s*\n([\s\S]*?)\n```/)
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1])
    } catch {
      return null
    }
  }

  // Also try looking for the drawing section
  const drawingMatch = content.match(/## Drawing\s*\n```json\s*\n([\s\S]*?)\n```/)
  if (drawingMatch) {
    try {
      return JSON.parse(drawingMatch[1])
    } catch {
      return null
    }
  }

  return null
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Generate a simple SVG preview from Excalidraw elements.
 * This is a lightweight approximation — not pixel-perfect.
 */
function renderSceneToSvg(scene: ExcalidrawScene): string | null {
  const elements = (scene.elements ?? []).filter((e) => !e.isDeleted)
  if (elements.length === 0) return null

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of elements) {
    const x1 = el.x
    const y1 = el.y
    const x2 = el.x + (el.width || 0)
    const y2 = el.y + (el.height || 0)

    // Also check points (for lines/arrows)
    if (el.points) {
      for (const [px, py] of el.points) {
        minX = Math.min(minX, el.x + px)
        minY = Math.min(minY, el.y + py)
        maxX = Math.max(maxX, el.x + px)
        maxY = Math.max(maxY, el.y + py)
      }
    }

    minX = Math.min(minX, x1)
    minY = Math.min(minY, y1)
    maxX = Math.max(maxX, x2)
    maxY = Math.max(maxY, y2)
  }

  const padding = 20
  const width = maxX - minX + padding * 2
  const height = maxY - minY + padding * 2
  const offsetX = -minX + padding
  const offsetY = -minY + padding

  const bgColor = scene.appState?.viewBackgroundColor ?? 'transparent'

  const svgParts: string[] = []
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `style="max-width:100%;max-height:50vh;width:auto;height:auto;">`,
  )
  if (bgColor !== 'transparent') {
    svgParts.push(`<rect width="${width}" height="${height}" fill="${escapeXml(bgColor)}"/>`)
  }

  for (const el of elements) {
    const opacity = el.opacity != null ? el.opacity / 100 : 1
    const stroke = el.strokeColor ?? '#1e1e1e'
    const fill = el.backgroundColor ?? 'transparent'
    const sw = el.strokeWidth ?? 1
    const tx = el.x + offsetX
    const ty = el.y + offsetY

    switch (el.type) {
      case 'rectangle':
        svgParts.push(
          `<rect x="${tx}" y="${ty}" width="${el.width}" height="${el.height}" ` +
          `stroke="${escapeXml(stroke)}" stroke-width="${sw}" fill="${escapeXml(fill)}" opacity="${opacity}"/>`,
        )
        break
      case 'ellipse':
        svgParts.push(
          `<ellipse cx="${tx + el.width / 2}" cy="${ty + el.height / 2}" ` +
          `rx="${el.width / 2}" ry="${el.height / 2}" ` +
          `stroke="${escapeXml(stroke)}" stroke-width="${sw}" fill="${escapeXml(fill)}" opacity="${opacity}"/>`,
        )
        break
      case 'diamond': {
        const cx = tx + el.width / 2
        const cy = ty + el.height / 2
        const pts = `${cx},${ty} ${tx + el.width},${cy} ${cx},${ty + el.height} ${tx},${cy}`
        svgParts.push(
          `<polygon points="${pts}" stroke="${escapeXml(stroke)}" stroke-width="${sw}" ` +
          `fill="${escapeXml(fill)}" opacity="${opacity}"/>`,
        )
        break
      }
      case 'line':
      case 'arrow': {
        if (el.points && el.points.length >= 2) {
          const d = el.points.map(([px, py], i) =>
            `${i === 0 ? 'M' : 'L'}${tx + px},${ty + py}`,
          ).join(' ')
          svgParts.push(
            `<path d="${d}" stroke="${escapeXml(stroke)}" stroke-width="${sw}" ` +
            `fill="none" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`,
          )
          // Arrow head
          if (el.type === 'arrow' && el.points.length >= 2) {
            const last = el.points[el.points.length - 1]
            const prev = el.points[el.points.length - 2]
            const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0])
            const headLen = Math.max(8, sw * 4)
            const lx = tx + last[0], ly = ty + last[1]
            const a1x = lx - headLen * Math.cos(angle - 0.4)
            const a1y = ly - headLen * Math.sin(angle - 0.4)
            const a2x = lx - headLen * Math.cos(angle + 0.4)
            const a2y = ly - headLen * Math.sin(angle + 0.4)
            svgParts.push(
              `<path d="M${a1x},${a1y} L${lx},${ly} L${a2x},${a2y}" ` +
              `stroke="${escapeXml(stroke)}" stroke-width="${sw}" fill="none" opacity="${opacity}" ` +
              `stroke-linecap="round" stroke-linejoin="round"/>`,
            )
          }
        }
        break
      }
      case 'freedraw': {
        if (el.points && el.points.length >= 2) {
          const d = el.points.map(([px, py], i) =>
            `${i === 0 ? 'M' : 'L'}${tx + px},${ty + py}`,
          ).join(' ')
          svgParts.push(
            `<path d="${d}" stroke="${escapeXml(stroke)}" stroke-width="${sw}" ` +
            `fill="none" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`,
          )
        }
        break
      }
      case 'text': {
        const fontSize = el.fontSize ?? 16
        svgParts.push(
          `<text x="${tx}" y="${ty + fontSize}" font-size="${fontSize}" ` +
          `fill="${escapeXml(stroke)}" opacity="${opacity}" font-family="sans-serif">` +
          `${escapeXml(el.text ?? '')}</text>`,
        )
        break
      }
      // image, frame, etc. — skip (no easy inline preview)
    }
  }

  svgParts.push('</svg>')
  return svgParts.join('\n')
}

/**
 * Load an Excalidraw file and return an SVG string preview.
 * Returns a basic SVG approximation of the drawing.
 */
export async function loadExcalidrawSvgPreviewBlock(path: string): Promise<string> {
  const fs = getVaultFS()
  const content = await fs.read(path)
  const scene = parseExcalidrawScene(content)
  if (!scene) throw new Error('Could not parse Excalidraw file')

  const svg = renderSceneToSvg(scene)
  if (!svg) throw new Error('No elements to render')

  return svg
}
