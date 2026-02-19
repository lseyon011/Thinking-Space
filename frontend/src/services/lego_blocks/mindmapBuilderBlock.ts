import type { ParsedExcalidrawScene } from './excalidrawFileBlock'
import { normalizeExcalidrawSceneForInteropBlock } from './excalidrawSceneCompatBlock'

export type MindmapGrowthMode = 'radial' | 'right-facing' | 'left-facing' | 'right-left' | 'up-facing' | 'down-facing'
export type MindmapFontScale = 'normal' | 'fibonacci'
export type MindmapArrowType = 'curved' | 'straight' | 'elbow'
export type MindmapFontFamily = 'virgil' | 'helvetica' | 'cascadia' | 'excalidraw'

export interface MindmapBuildOptions {
  includeFullText: boolean
  maxDepth: number
  maxWrapWidth: number
  growthMode: MindmapGrowthMode
  arrowType: MindmapArrowType
  fillSweep: boolean
  centerText: boolean
  multicolorBranches: boolean
  boxNodes: boolean
  roundedCorners: boolean
  fontScale: MindmapFontScale
  fontFamily: MindmapFontFamily
}

export interface MindmapBuildStats {
  sourceLineCount: number
  headingCount: number
  nodeCount: number
  connectionCount: number
}

export interface MindmapBuildResult {
  scene: ParsedExcalidrawScene
  stats: MindmapBuildStats
}

interface HeadingRow {
  level: number
  title: string
  content: string
}

interface HeadingTreeNode {
  title: string
  content: string
  depth: number
  children: HeadingTreeNode[]
}

interface MindmapNode {
  id: string
  parentId: string | null
  kind: 'root' | 'heading' | 'content'
  text: string
  depth: number
  order: number
  branchIndex: number
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

interface NodeRenderRefs {
  rectId: string
  textId: string
}

interface LayoutContext {
  nodesById: Map<string, MindmapNode>
  childrenByParent: Map<string, MindmapNode[]>
  heightCache: Map<string, number>
  widthCache: Map<string, number>
}

const ROOT_ID = 'mindmap_root'
const ROOT_FILL = '#fff4e6'
const ROOT_STROKE = '#9a3412'
const DEFAULT_BRANCH = { fill: '#e2e8f0', stroke: '#334155' }

const BRANCH_PALETTE = [
  { fill: '#dbeafe', stroke: '#1d4ed8' },
  { fill: '#dcfce7', stroke: '#15803d' },
  { fill: '#fef3c7', stroke: '#b45309' },
  { fill: '#fee2e2', stroke: '#b91c1c' },
  { fill: '#f3e8ff', stroke: '#7e22ce' },
  { fill: '#ccfbf1', stroke: '#0f766e' },
  { fill: '#fce7f3', stroke: '#be185d' },
  { fill: '#e0f2fe', stroke: '#0369a1' },
]

const LAYOUT_DEFAULTS = {
  GAP_X: 120,
  GAP_Y: 25,
  GAP_MULTIPLIER: 0.6,
  ROOT_RADIUS_FACTOR: 0.8,
  MIN_RADIUS: 350,
  RADIAL_ASPECT_RATIO: 0.7,
  RADIAL_POLE_GAP_BONUS: 2.0,
  RADIAL_START_ANGLE: 280,
  RADIAL_MAX_SWEEP: 340,
  DIRECTIONAL_ARC_SPAN_RADIANS: 1.0,
  GAP_MULTIPLIER_DIRECTIONAL: 1.5,
  RADIUS_PADDING_PER_NODE: 7,
}

const VERTICAL_EXTRA_GAP = 12
const WRAP_WIDTH_MAX = 10000

export const DEFAULT_MINDMAP_BUILD_OPTIONS: MindmapBuildOptions = {
  includeFullText: true,
  maxDepth: 6,
  maxWrapWidth: WRAP_WIDTH_MAX,
  growthMode: 'right-left',
  arrowType: 'curved',
  fillSweep: false,
  centerText: false,
  multicolorBranches: true,
  boxNodes: true,
  roundedCorners: true,
  fontScale: 'fibonacci',
  fontFamily: 'excalidraw',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function hashNumber(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash || 1
}

function titleFromPath(path: string): string {
  const name = path.split('/').pop() || path
  return name.replace(/\.md$/i, '').replace(/_/g, ' ').trim() || 'Mindmap'
}

function normalizeBody(body: string): string {
  return body
    .replace(/\r/g, '')
    .trim()
}

function fontSizeForDepth(depth: number, scale: MindmapFontScale): number {
  const normal = [36, 28, 20, 16]
  const fibonacci = [68, 42, 26, 16]
  const table = scale === 'fibonacci' ? fibonacci : normal
  return table[Math.min(depth, table.length - 1)]
}

function fontFamilyId(family: MindmapFontFamily): number {
  switch (family) {
    case 'excalidraw':
      return 5
    case 'virgil':
      return 1
    case 'cascadia':
      return 3
    case 'helvetica':
    default:
      return 2
  }
}

function getVerticalGapForDepth(depth: number): number {
  if (depth <= 1) return 5
  if (depth === 2) return 8
  let a = 5
  let b = 8
  for (let i = 3; i <= depth; i += 1) {
    const c = a + b
    a = b
    b = c
  }
  return b
}

function isVerticalGrowthMode(mode: MindmapGrowthMode): boolean {
  return mode === 'up-facing' || mode === 'down-facing'
}

function estimateCharWidthPx(char: string, fontSize: number): number {
  if (char === '\u00A0' || /\s/u.test(char)) return fontSize * 0.3
  if (/[ilI1.,:;!'`|]/u.test(char)) return fontSize * 0.3
  if (/[mwMW@#%&Q]/u.test(char)) return fontSize * 0.82
  if (/[A-Z]/u.test(char)) return fontSize * 0.65
  if (/[0-9]/u.test(char)) return fontSize * 0.56
  if (char.codePointAt(0) != null && char.codePointAt(0)! > 0x7f) return fontSize * 0.62
  return fontSize * 0.52
}

function estimateLineWidthPx(text: string, fontSize: number): number {
  let width = 0
  for (const char of Array.from(text)) {
    width += estimateCharWidthPx(char, fontSize)
  }
  return width
}

function wrapWordByWidth(word: string, maxWidthPx: number, fontSize: number): string[] {
  if (!word) return ['']
  const lines: string[] = []
  let current = ''
  let currentWidth = 0

  for (const char of Array.from(word)) {
    const charWidth = estimateCharWidthPx(char, fontSize)
    if (currentWidth + charWidth <= maxWidthPx || !current) {
      current += char
      currentWidth += charWidth
      continue
    }
    lines.push(current)
    current = char
    currentWidth = charWidth
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function wrapLineByWidth(rawLine: string, maxWidthPx: number, fontSize: number): string[] {
  if (!rawLine.trim()) return ['']

  const tokens = rawLine.match(/\s+|[^\s]+/gu) ?? [rawLine]
  const lines: string[] = []
  let current = ''

  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]
    const candidate = current + token
    const candidateWidth = estimateLineWidthPx(candidate, fontSize)
    const isWhitespace = /^\s+$/u.test(token)

    if (isWhitespace || candidateWidth <= maxWidthPx) {
      current = candidate
      index += 1
      continue
    }

    if (!current) {
      const wrapped = wrapWordByWidth(token, maxWidthPx, fontSize)
      const trailing = wrapped[wrapped.length - 1] ?? ''
      const head = wrapped.slice(0, -1)
      if (head.length > 0) lines.push(...head)
      current = trailing
      index += 1
      continue
    }

    lines.push(current.trimEnd())
    current = ''
  }

  if (current) lines.push(current.trimEnd())
  return lines
}

function wrapPreservingBreaks(text: string, maxWidthPx: number, fontSize: number, preserveNbsp = false): string {
  if (!Number.isFinite(maxWidthPx) || maxWidthPx <= 0) {
    return text.replace(/\r/g, '')
  }

  const rawLines = text.replace(/\r/g, '').split('\n')
  const out: string[] = []

  for (const raw of rawLines) {
    if (preserveNbsp && raw === '\u00A0') {
      out.push('\u00A0')
      continue
    }

    if (!raw.trim()) {
      out.push('')
      continue
    }
    out.push(...wrapLineByWidth(raw, maxWidthPx, fontSize))
  }

  const joined = out.join('\n')
  return preserveNbsp ? joined : joined.trim()
}

function parseHeadingRows(markdown: string, maxDepth: number): HeadingRow[] {
  const normalized = markdown.replace(/\r/g, '')
  const lines = normalized.split('\n')
  const headings: Array<{ line: number; level: number; title: string }> = []

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/)
    if (!match) continue
    const level = match[1].length
    if (level > maxDepth) continue
    const title = match[2].trim()
    if (!title) continue
    if (title === 'Excalidraw Data') break
    headings.push({ line: i, level, title })
  }

  const rows: HeadingRow[] = []
  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i]
    const next = headings[i + 1]
    const contentStart = current.line + 1
    const contentEnd = next ? next.line : lines.length
    rows.push({
      level: current.level,
      title: current.title,
      content: normalizeBody(lines.slice(contentStart, contentEnd).join('\n')),
    })
  }
  return rows
}

function buildHeadingTree(rows: HeadingRow[]): HeadingTreeNode[] {
  const root: HeadingTreeNode = { title: '__root__', content: '', depth: 0, children: [] }
  const stack: HeadingTreeNode[] = [root]

  for (const row of rows) {
    while (stack.length > 1 && row.level <= stack[stack.length - 1].depth) {
      stack.pop()
    }
    const node: HeadingTreeNode = {
      title: row.title,
      content: row.content,
      depth: row.level,
      children: [],
    }
    stack[stack.length - 1].children.push(node)
    stack.push(node)
  }

  return root.children
}

function createGraphNodes(tree: HeadingTreeNode[], sourcePath: string, options: MindmapBuildOptions): { nodes: MindmapNode[]; headingCount: number } {
  const nodes: MindmapNode[] = []
  const orderCounter = new Map<string, number>()
  let seq = 0

  const nextId = (prefix: string): string => {
    seq += 1
    return `${prefix}_${seq}`
  }

  const nextOrder = (parentId: string): number => {
    const current = orderCounter.get(parentId) ?? 0
    orderCounter.set(parentId, current + 1)
    return current
  }

  const toScriptNodeLabel = (rawText: string): string => {
    const text = rawText.trim()
    if (!text) return text
    if (text.startsWith('📍[[') && text.endsWith(']]')) return text
    return `📍[[${text}]]`
  }

  const root: MindmapNode = {
    id: ROOT_ID,
    parentId: null,
    kind: 'root',
    text: toScriptNodeLabel(titleFromPath(sourcePath)),
    depth: 0,
    order: 0,
    branchIndex: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    fontSize: 0,
  }
  nodes.push(root)

  let headingCount = 0

  const emit = (heading: HeadingTreeNode, parentId: string, depth: number, branchIndex: number) => {
    const headingId = nextId('heading')
    headingCount += 1

    nodes.push({
      id: headingId,
      parentId,
      kind: 'heading',
      text: toScriptNodeLabel(heading.title),
      depth,
      order: nextOrder(parentId),
      branchIndex,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      fontSize: 0,
    })

    let childParentId = headingId
    let childDepth = depth + 1

    if (options.includeFullText && heading.content) {
      const contentId = nextId('content')
      nodes.push({
        id: contentId,
        parentId: headingId,
        kind: 'content',
        text: heading.content,
        depth: depth + 1,
        order: nextOrder(headingId),
        branchIndex,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        fontSize: 0,
      })
      childParentId = contentId
      childDepth = depth + 2
    }

    for (const child of heading.children) {
      emit(child, childParentId, childDepth, branchIndex)
    }
  }

  for (let i = 0; i < tree.length; i += 1) {
    emit(tree[i], ROOT_ID, 1, i)
  }

  return { nodes, headingCount }
}

function assignTextMetrics(nodes: MindmapNode[], options: MindmapBuildOptions): void {
  for (const node of nodes) {
    const fontSize = fontSizeForDepth(node.depth, options.fontScale)
    const horizontalPadding = node.kind === 'content' ? 18 : 14
    const verticalPadding = node.kind === 'content' ? 20 : 10
    const effectiveMaxWidth = options.maxWrapWidth >= WRAP_WIDTH_MAX
      ? Number.POSITIVE_INFINITY
      : Math.max(options.maxWrapWidth, 100)
    const normalizedText = node.text.replace(/\r/g, '').trim()
    const sourceLines = normalizedText ? normalizedText.split('\n') : ['']
    const sourceMaxLineWidth = sourceLines.reduce(
      (max, line) => Math.max(max, estimateLineWidthPx(line, fontSize)),
      0,
    )
    const shouldWrap = Number.isFinite(effectiveMaxWidth) && sourceMaxLineWidth > effectiveMaxWidth
    const measuredText = shouldWrap
      ? wrapPreservingBreaks(normalizedText, effectiveMaxWidth, fontSize, node.kind === 'content')
      : normalizedText
    const wrapped = node.kind === 'content' ? normalizedText : measuredText
    const lines = measuredText ? measuredText.split('\n') : ['']
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0)
    const measuredMaxLineWidth = lines.reduce(
      (max, line) => Math.max(max, estimateLineWidthPx(line, fontSize)),
      0,
    )
    const widthCap = Number.isFinite(effectiveMaxWidth)
      ? effectiveMaxWidth + horizontalPadding * 2
      : Number.POSITIVE_INFINITY

    let width = Math.round(measuredMaxLineWidth + horizontalPadding * 2)
    width = Math.max(width, node.kind === 'root' ? 220 : 140)
    if (Number.isFinite(widthCap)) width = Math.min(width, Math.round(widthCap))

    const baseHeight = Math.round(lines.length * Math.max(fontSize * 1.42, 20) + verticalPadding * 2)
    const height = node.kind === 'content'
      ? Math.max(baseHeight, 54)
      : clamp(baseHeight, 54, 2400)

    node.fontSize = fontSize
    node.text = wrapped
    node.width = width
    node.height = height
  }

  const root = nodes.find(node => node.id === ROOT_ID)
  if (root) {
    root.x = -root.width / 2
    root.y = -root.height / 2
  }
}

function buildLayoutContext(nodes: MindmapNode[]): LayoutContext {
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const childrenByParent = new Map<string, MindmapNode[]>()

  for (const node of nodes) {
    if (!node.parentId) continue
    const children = childrenByParent.get(node.parentId) ?? []
    children.push(node)
    childrenByParent.set(node.parentId, children)
  }

  for (const [, children] of childrenByParent) {
    children.sort((a, b) => a.order - b.order)
  }

  return {
    nodesById,
    childrenByParent,
    heightCache: new Map<string, number>(),
    widthCache: new Map<string, number>(),
  }
}

function getSubtreeHeight(nodeId: string, ctx: LayoutContext): number {
  const cached = ctx.heightCache.get(nodeId)
  if (cached != null) return cached

  const node = ctx.nodesById.get(nodeId)
  if (!node) return 0

  const children = ctx.childrenByParent.get(nodeId) ?? []
  if (children.length === 0) {
    ctx.heightCache.set(nodeId, node.height)
    return node.height
  }

  let childrenHeight = 0
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]
    childrenHeight += getSubtreeHeight(child.id, ctx)

    if (i < children.length - 1) {
      const grandChildren = ctx.childrenByParent.get(child.id) ?? []
      const gap = grandChildren.length === 0
        ? Math.round(child.fontSize * LAYOUT_DEFAULTS.GAP_MULTIPLIER)
        : LAYOUT_DEFAULTS.GAP_Y
      childrenHeight += gap
    }
  }

  const total = Math.max(node.height, childrenHeight)
  ctx.heightCache.set(nodeId, total)
  return total
}

function getSubtreeWidth(nodeId: string, ctx: LayoutContext): number {
  const cached = ctx.widthCache.get(nodeId)
  if (cached != null) return cached

  const node = ctx.nodesById.get(nodeId)
  if (!node) return 0

  const children = ctx.childrenByParent.get(nodeId) ?? []
  if (children.length === 0) {
    ctx.widthCache.set(nodeId, node.width)
    return node.width
  }

  let childrenWidth = 0
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]
    childrenWidth += getSubtreeWidth(child.id, ctx)

    if (i < children.length - 1) {
      const grandChildren = ctx.childrenByParent.get(child.id) ?? []
      const gap = grandChildren.length === 0
        ? Math.round(child.fontSize * LAYOUT_DEFAULTS.GAP_MULTIPLIER)
        : LAYOUT_DEFAULTS.GAP_X
      childrenWidth += gap
    }
  }

  const total = Math.max(node.width, childrenWidth)
  ctx.widthCache.set(nodeId, total)
  return total
}

function layoutSubtree(nodeId: string, targetX: number, targetCenterY: number, side: 1 | -1, ctx: LayoutContext): void {
  const node = ctx.nodesById.get(nodeId)
  if (!node) return

  node.x = side === 1 ? targetX : targetX - node.width
  node.y = targetCenterY - node.height / 2

  const children = ctx.childrenByParent.get(nodeId) ?? []
  if (children.length === 0) return

  const subtreeHeight = getSubtreeHeight(nodeId, ctx)
  let currentY = targetCenterY - subtreeHeight / 2

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]
    const childHeight = getSubtreeHeight(child.id, ctx)

    layoutSubtree(
      child.id,
      side === 1 ? node.x + node.width + LAYOUT_DEFAULTS.GAP_X : node.x - LAYOUT_DEFAULTS.GAP_X,
      currentY + childHeight / 2,
      side,
      ctx,
    )

    if (i < children.length - 1) {
      const grandChildren = ctx.childrenByParent.get(child.id) ?? []
      const gap = grandChildren.length === 0
        ? Math.round(child.fontSize * LAYOUT_DEFAULTS.GAP_MULTIPLIER)
        : LAYOUT_DEFAULTS.GAP_Y
      currentY += childHeight + gap
    }
  }
}

function layoutSubtreeVertical(
  nodeId: string,
  targetCenterX: number,
  targetY: number,
  direction: 1 | -1,
  ctx: LayoutContext,
  depth = 1,
): void {
  const node = ctx.nodesById.get(nodeId)
  if (!node) return

  node.x = targetCenterX - node.width / 2
  node.y = direction === 1 ? targetY : targetY - node.height

  const children = ctx.childrenByParent.get(nodeId) ?? []
  if (children.length === 0) return

  const subtreeWidth = getSubtreeWidth(nodeId, ctx)
  let currentX = targetCenterX - subtreeWidth / 2
  const dynamicGapY = LAYOUT_DEFAULTS.GAP_Y + VERTICAL_EXTRA_GAP + getVerticalGapForDepth(depth + 1)

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]
    const childWidth = getSubtreeWidth(child.id, ctx)

    layoutSubtreeVertical(
      child.id,
      currentX + childWidth / 2,
      direction === 1 ? node.y + node.height + dynamicGapY : node.y - dynamicGapY,
      direction,
      ctx,
      depth + 1,
    )

    if (i < children.length - 1) {
      const grandChildren = ctx.childrenByParent.get(child.id) ?? []
      const gap = grandChildren.length === 0
        ? Math.round(child.fontSize * LAYOUT_DEFAULTS.GAP_MULTIPLIER)
        : LAYOUT_DEFAULTS.GAP_X
      currentX += childWidth + gap
    }
  }
}

function radialL1Distribution(nodes: MindmapNode[], root: MindmapNode, ctx: LayoutContext, options: MindmapBuildOptions): void {
  const count = nodes.length
  if (count === 0) return

  const rootCenter = { x: root.x + root.width / 2, y: root.y + root.height / 2 }
  const l1Metrics = nodes.map(node => getSubtreeHeight(node.id, ctx))

  const startAngle = LAYOUT_DEFAULTS.RADIAL_START_ANGLE
  const maxSweep = options.fillSweep
    ? LAYOUT_DEFAULTS.RADIAL_MAX_SWEEP
    : Math.min((LAYOUT_DEFAULTS.RADIAL_MAX_SWEEP / 8) * count, LAYOUT_DEFAULTS.RADIAL_MAX_SWEEP)

  const minRadiusY = Math.max(
    Math.round(Math.max(root.height, root.width) * LAYOUT_DEFAULTS.ROOT_RADIUS_FACTOR * 1.5),
    LAYOUT_DEFAULTS.MIN_RADIUS,
  )
  const minRadiusX = minRadiusY * LAYOUT_DEFAULTS.RADIAL_ASPECT_RATIO

  const baseGap = LAYOUT_DEFAULTS.GAP_Y * 2

  let simAngle = startAngle
  let totalRequiredSpan = 0

  const simulated = nodes.map((node, index) => {
    const rad = (simAngle * Math.PI) / 180
    const localR = (minRadiusX * minRadiusY) / Math.sqrt(
      Math.pow(minRadiusY * Math.cos(rad), 2) + Math.pow(minRadiusX * Math.sin(rad), 2),
    )

    const sinComp = Math.abs(Math.sin(rad))
    const cosComp = Math.abs(Math.cos(rad))
    const effSize = node.width * sinComp + l1Metrics[index] * cosComp
    const nodeSpan = (effSize / Math.max(localR, 1e-6)) * (180 / Math.PI)

    const isLast = index === nodes.length - 1
    const dynamicGapPx = isLast ? 0 : baseGap * (1 + sinComp * LAYOUT_DEFAULTS.RADIAL_POLE_GAP_BONUS)
    const gapSpan = (dynamicGapPx / Math.max(localR, 1e-6)) * (180 / Math.PI)

    const totalSpan = nodeSpan + gapSpan
    simAngle += totalSpan
    totalRequiredSpan += totalSpan

    return { node, nodeSpan, gapSpan }
  })

  let finalRadiusY = minRadiusY
  let angleExpansion = 1

  if (totalRequiredSpan > maxSweep) {
    const radiusScale = totalRequiredSpan / Math.max(maxSweep, 1e-6)
    finalRadiusY = minRadiusY * radiusScale
    angleExpansion = 1 / Math.max(radiusScale, 1e-6)
  } else if (totalRequiredSpan > 0) {
    angleExpansion = maxSweep / totalRequiredSpan
  }

  const finalRadiusX = finalRadiusY * LAYOUT_DEFAULTS.RADIAL_ASPECT_RATIO
  let currentAngle = startAngle

  for (const entry of simulated) {
    const realNodeSpan = entry.nodeSpan * angleExpansion
    const realGapSpan = entry.gapSpan * angleExpansion
    const placementAngle = currentAngle + realNodeSpan / 2
    const normalized = ((placementAngle % 360) + 360) % 360
    const side: 1 | -1 = normalized > 90 && normalized < 270 ? -1 : 1

    const rad = (placementAngle * Math.PI) / 180
    const localR = (finalRadiusX * finalRadiusY) / Math.sqrt(
      Math.pow(finalRadiusY * Math.cos(rad), 2) + Math.pow(finalRadiusX * Math.sin(rad), 2),
    )

    const targetCenterX = rootCenter.x + localR * Math.cos(rad)
    const targetCenterY = rootCenter.y + localR * Math.sin(rad)

    layoutSubtree(entry.node.id, targetCenterX, targetCenterY, side, ctx)
    currentAngle += realNodeSpan + realGapSpan
  }
}

function verticalL1Distribution(
  nodes: MindmapNode[],
  root: MindmapNode,
  ctx: LayoutContext,
  side: 1 | -1,
): void {
  const count = nodes.length
  if (count === 0) return

  const l1Metrics = nodes.map(node => getSubtreeHeight(node.id, ctx))
  const totalSubtreeHeight = l1Metrics.reduce((sum, value) => sum + value, 0)

  const totalContentHeight = totalSubtreeHeight + (count - 1) * LAYOUT_DEFAULTS.GAP_Y
  const radiusFromHeight = totalContentHeight / LAYOUT_DEFAULTS.DIRECTIONAL_ARC_SPAN_RADIANS
  const radiusY = Math.max(
    Math.round(root.height * LAYOUT_DEFAULTS.ROOT_RADIUS_FACTOR),
    LAYOUT_DEFAULTS.MIN_RADIUS,
    radiusFromHeight,
  ) + count * LAYOUT_DEFAULTS.RADIUS_PADDING_PER_NODE
  const radiusX = Math.max(
    Math.round(root.width * LAYOUT_DEFAULTS.ROOT_RADIUS_FACTOR),
    LAYOUT_DEFAULTS.MIN_RADIUS,
    radiusY * 0.2,
  ) + count * LAYOUT_DEFAULTS.RADIUS_PADDING_PER_NODE

  const centerAngle = side === -1 ? 270 : 90
  const totalThetaDeg = (totalContentHeight / Math.max(radiusY, 1e-6)) * (180 / Math.PI)
  let currentAngle = side === -1 ? centerAngle + totalThetaDeg / 2 : centerAngle - totalThetaDeg / 2

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const nodeHeight = l1Metrics[i]

    const effectiveGap = LAYOUT_DEFAULTS.GAP_Y * LAYOUT_DEFAULTS.GAP_MULTIPLIER_DIRECTIONAL
    const gapSpanDeg = (effectiveGap / Math.max(radiusY, 1e-6)) * (180 / Math.PI)
    const nodeSpanDeg = (nodeHeight / Math.max(radiusY, 1e-6)) * (180 / Math.PI)

    const angleDeg = side === -1 ? currentAngle - nodeSpanDeg / 2 : currentAngle + nodeSpanDeg / 2
    currentAngle = side === -1
      ? currentAngle - (nodeSpanDeg + gapSpanDeg)
      : currentAngle + (nodeSpanDeg + gapSpanDeg)

    const angleRad = ((angleDeg - 90) * Math.PI) / 180
    const targetCenterX = root.x + root.width / 2 + radiusX * Math.cos(angleRad)
    const targetCenterY = root.y + root.height / 2 + radiusY * Math.sin(angleRad)

    layoutSubtree(node.id, targetCenterX, targetCenterY, side, ctx)
  }
}

function horizontalL1Distribution(
  nodes: MindmapNode[],
  root: MindmapNode,
  ctx: LayoutContext,
  direction: 1 | -1,
): void {
  const count = nodes.length
  if (count === 0) return

  const rootCenter = { x: root.x + root.width / 2, y: root.y + root.height / 2 }
  const l1Metrics = nodes.map(node => getSubtreeWidth(node.id, ctx))
  const totalSubtreeWidth = l1Metrics.reduce((sum, value) => sum + value, 0)

  const totalContentWidth = totalSubtreeWidth + (count - 1) * LAYOUT_DEFAULTS.GAP_X
  const radiusFromWidth = totalContentWidth / LAYOUT_DEFAULTS.DIRECTIONAL_ARC_SPAN_RADIANS
  const radiusX = Math.max(
    Math.round(root.width * LAYOUT_DEFAULTS.ROOT_RADIUS_FACTOR),
    LAYOUT_DEFAULTS.MIN_RADIUS,
    radiusFromWidth,
  ) + count * LAYOUT_DEFAULTS.RADIUS_PADDING_PER_NODE
  const radiusY = Math.max(
    Math.round(root.height * LAYOUT_DEFAULTS.ROOT_RADIUS_FACTOR),
    LAYOUT_DEFAULTS.MIN_RADIUS,
    radiusX * 0.2,
  ) + count * LAYOUT_DEFAULTS.RADIUS_PADDING_PER_NODE

  const centerAngle = direction === -1 ? 0 : 180
  const totalThetaDeg = (totalContentWidth / Math.max(radiusX, 1e-6)) * (180 / Math.PI)
  let currentAngle = direction === -1 ? centerAngle + totalThetaDeg / 2 : centerAngle - totalThetaDeg / 2

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const nodeWidth = l1Metrics[i]

    const effectiveGap = LAYOUT_DEFAULTS.GAP_X * LAYOUT_DEFAULTS.GAP_MULTIPLIER_DIRECTIONAL
    const gapSpanDeg = (effectiveGap / Math.max(radiusX, 1e-6)) * (180 / Math.PI)
    const nodeSpanDeg = (nodeWidth / Math.max(radiusX, 1e-6)) * (180 / Math.PI)

    const angleDeg = direction === -1 ? currentAngle - nodeSpanDeg / 2 : currentAngle + nodeSpanDeg / 2
    currentAngle = direction === -1
      ? currentAngle - (nodeSpanDeg + gapSpanDeg)
      : currentAngle + (nodeSpanDeg + gapSpanDeg)

    const angleRad = ((angleDeg - 90) * Math.PI) / 180
    const targetCenterX = rootCenter.x + radiusX * Math.cos(angleRad)
    const targetCenterY = rootCenter.y + radiusY * Math.sin(angleRad)

    layoutSubtreeVertical(node.id, targetCenterX, targetCenterY, direction, ctx, 1)
  }
}

function layoutByGrowthMode(nodes: MindmapNode[], options: MindmapBuildOptions): void {
  const ctx = buildLayoutContext(nodes)
  const root = ctx.nodesById.get(ROOT_ID)
  if (!root) return

  const l1Nodes = (ctx.childrenByParent.get(ROOT_ID) ?? []).slice().sort((a, b) => a.order - b.order)
  if (l1Nodes.length === 0) return

  switch (options.growthMode) {
    case 'radial': {
      radialL1Distribution(l1Nodes, root, ctx, options)
      break
    }
    case 'up-facing': {
      horizontalL1Distribution(l1Nodes, root, ctx, -1)
      break
    }
    case 'down-facing': {
      horizontalL1Distribution(l1Nodes, root, ctx, 1)
      break
    }
    case 'left-facing': {
      verticalL1Distribution(l1Nodes, root, ctx, -1)
      break
    }
    case 'right-left': {
      const splitIndex = Math.ceil(l1Nodes.length / 2)
      const rightNodes = l1Nodes.slice(0, splitIndex)
      const leftNodes = l1Nodes.slice(splitIndex)
      if (rightNodes.length > 0) verticalL1Distribution(rightNodes, root, ctx, 1)
      if (leftNodes.length > 0) verticalL1Distribution(leftNodes, root, ctx, -1)
      break
    }
    case 'right-facing':
    default: {
      verticalL1Distribution(l1Nodes, root, ctx, 1)
      break
    }
  }
}

function deriveNodeColor(branchIndex: number, options: MindmapBuildOptions): { fill: string; stroke: string } {
  if (!options.multicolorBranches) return DEFAULT_BRANCH
  return BRANCH_PALETTE[Math.max(branchIndex, 0) % BRANCH_PALETTE.length] ?? DEFAULT_BRANCH
}

function resolveTextAlign(node: MindmapNode, parent: MindmapNode | null, options: MindmapBuildOptions): 'left' | 'right' | 'center' {
  if (options.centerText) return 'center'
  if (isVerticalGrowthMode(options.growthMode)) return 'center'
  if (!parent) return 'center'

  const nodeCenterX = node.x + node.width / 2
  const parentCenterX = parent.x + parent.width / 2
  return nodeCenterX >= parentCenterX ? 'left' : 'right'
}

function buildArrowPoints(params: {
  arrowType: MindmapArrowType
  dx: number
  dy: number
  orientation: 'horizontal' | 'vertical'
  isRadialRootArrow: boolean
}): Array<[number, number]> {
  const { arrowType, dx, dy, orientation, isRadialRootArrow } = params

  if (arrowType === 'straight') {
    return [
      [0, 0],
      [dx, dy],
    ]
  }

  if (arrowType === 'elbow') {
    if (orientation === 'vertical') {
      const midY = dy / 2
      return [
        [0, 0],
        [0, midY],
        [dx, midY],
        [dx, dy],
      ]
    }
    const midX = dx / 2
    return [
      [0, 0],
      [midX, 0],
      [midX, dy],
      [dx, dy],
    ]
  }

  if (isRadialRootArrow) {
    return [
      [0, 0],
      [dx * (2 / 3), dy * 0.75],
      [dx, dy],
    ]
  }

  return [
    [0, 0],
    [dx / 3, dy * 0.25],
    [dx * (2 / 3), dy * 0.75],
    [dx, dy],
  ]
}

function toScriptGrowthMode(mode: MindmapGrowthMode): string {
  switch (mode) {
    case 'radial':
      return 'Radial'
    case 'right-facing':
      return 'Right-facing'
    case 'left-facing':
      return 'Left-facing'
    case 'right-left':
      return 'Right-Left'
    case 'up-facing':
      return 'Up-facing'
    case 'down-facing':
      return 'Down-facing'
    default:
      return 'Right-Left'
  }
}

function buildNodeCustomData(node: MindmapNode, options: MindmapBuildOptions): Record<string, unknown> {
  const data: Record<string, unknown> = {
    mindmapOrder: node.order,
  }

  if (node.id === ROOT_ID) {
    data.growthMode = toScriptGrowthMode(options.growthMode)
    data.autoLayoutDisabled = false
    data.arrowType = options.arrowType
    data.centerText = options.centerText
    data.maxWrapWidth = options.maxWrapWidth
    data.multicolor = options.multicolorBranches
    data.boxChildren = options.boxNodes
    data.roundedCorners = options.roundedCorners
  }

  if (node.depth === 1) {
    data.mindmapNew = false
  }

  return data
}

function buildScene(nodes: MindmapNode[], options: MindmapBuildOptions): ParsedExcalidrawScene {
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const nodeRenderRefs = new Map<string, NodeRenderRefs>()
  const elements: Array<Record<string, unknown>> = []
  let sequence = 0
  const textFamily = fontFamilyId(options.fontFamily)

  const nextId = (prefix: string): string => {
    sequence += 1
    return `${prefix}_${sequence}`
  }

  for (const node of nodes) {
    const parent = node.parentId ? nodesById.get(node.parentId) ?? null : null
    const isRoot = node.id === ROOT_ID
    const rectId = nextId('node')
    const textId = nextId('text')

    const colors = isRoot ? { fill: ROOT_FILL, stroke: ROOT_STROKE } : deriveNodeColor(node.branchIndex, options)
    const textAlign = resolveTextAlign(node, parent, options)
    const textPadding = textAlign === 'center' ? 12 : 16
    const nodeCustomData = buildNodeCustomData(node, options)

    elements.push({
      id: rectId,
      type: 'rectangle',
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      strokeColor: colors.stroke,
      backgroundColor: options.boxNodes ? colors.fill : 'transparent',
      fillStyle: 'solid',
      strokeWidth: options.boxNodes ? 2 : 1,
      roughness: 0,
      opacity: 100,
      angle: 0,
      roundness: options.boxNodes && options.roundedCorners ? { type: 3 } : null,
      boundElements: [{ id: textId, type: 'text' }],
      isDeleted: false,
      groupIds: [],
      seed: hashNumber(`seed:${rectId}`),
      version: 1,
      versionNonce: hashNumber(`nonce:${rectId}`),
      customData: nodeCustomData,
    })

    elements.push({
      id: textId,
      type: 'text',
      x: node.x + textPadding,
      y: node.y + 10,
      width: node.width - textPadding * 2,
      height: node.height - 20,
      text: node.text,
      fontSize: node.fontSize,
      fontFamily: textFamily,
      textAlign,
      verticalAlign: 'middle',
      lineHeight: 1.25,
      autoResize: true,
      strokeColor: '#111827',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      angle: 0,
      containerId: rectId,
      isDeleted: false,
      groupIds: [],
      originalText: node.text,
      seed: hashNumber(`seed:${textId}`),
      version: 1,
      versionNonce: hashNumber(`nonce:${textId}`),
      customData: nodeCustomData,
    })

    nodeRenderRefs.set(node.id, { rectId, textId })
  }

  for (const node of nodes) {
    if (!node.parentId) continue
    const parent = nodesById.get(node.parentId)
    if (!parent) continue

    const arrowId = nextId('arrow')
    const colors = deriveNodeColor(node.branchIndex, options)
    const parentRefs = nodeRenderRefs.get(parent.id)
    const nodeRefs = nodeRenderRefs.get(node.id)

    const parentCenterX = parent.x + parent.width / 2
    const parentCenterY = parent.y + parent.height / 2
    const childCenterX = node.x + node.width / 2
    const childCenterY = node.y + node.height / 2

    const isVerticalOrientation = isVerticalGrowthMode(options.growthMode)
    const isRadialRootArrow = options.growthMode === 'radial' && parent.id === ROOT_ID

    let sX = parentCenterX
    let sY = parentCenterY
    let eX = childCenterX
    let eY = childCenterY
    let orientation: 'horizontal' | 'vertical' = 'horizontal'

    if (isVerticalOrientation) {
      orientation = 'vertical'
      const isChildDown = childCenterY > parentCenterY
      sX = parentCenterX
      sY = isChildDown ? parent.y + parent.height : parent.y
      eX = childCenterX
      eY = isChildDown ? node.y : node.y + node.height
    } else {
      orientation = 'horizontal'
      const isChildRight = childCenterX > parentCenterX
      sX = isRadialRootArrow
        ? parentCenterX
        : isChildRight
          ? parent.x + parent.width
          : parent.x
      sY = parentCenterY
      eX = isChildRight ? node.x : node.x + node.width
      eY = childCenterY
    }

    const dx = eX - sX
    const dy = eY - sY

    elements.push({
      id: arrowId,
      type: 'arrow',
      x: sX,
      y: sY,
      width: dx,
      height: dy,
      points: buildArrowPoints({
        arrowType: options.arrowType,
        dx,
        dy,
        orientation,
        isRadialRootArrow,
      }),
      strokeColor: colors.stroke,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      angle: 0,
      roundness: options.arrowType === 'curved' ? { type: 2 } : null,
      startBinding: parentRefs ? { elementId: parentRefs.rectId } : null,
      endBinding: nodeRefs ? { elementId: nodeRefs.rectId } : null,
      startArrowhead: null,
      endArrowhead: null,
      isDeleted: false,
      groupIds: [],
      seed: hashNumber(`seed:${arrowId}`),
      version: 1,
      versionNonce: hashNumber(`nonce:${arrowId}`),
      customData: { isBranch: true },
    })
  }

  return normalizeExcalidrawSceneForInteropBlock({
    elements,
    appState: {
      viewBackgroundColor: '#ffffff',
      gridSize: 20,
    },
  })
}

export function buildMindmapSceneFromMarkdownBlock(
  markdown: string,
  sourcePath: string,
  options: MindmapBuildOptions,
): MindmapBuildResult {
  const maxDepth = clamp(options.maxDepth, 1, 6)
  const rows = parseHeadingRows(markdown, maxDepth)
  const tree = buildHeadingTree(rows)
  const graph = createGraphNodes(tree, sourcePath, options)

  assignTextMetrics(graph.nodes, options)
  layoutByGrowthMode(graph.nodes, options)

  return {
    scene: buildScene(graph.nodes, options),
    stats: {
      sourceLineCount: markdown.replace(/\r/g, '').split('\n').length,
      headingCount: graph.headingCount,
      nodeCount: graph.nodes.length,
      connectionCount: Math.max(graph.nodes.length - 1, 0),
    },
  }
}

export function serializeMindmapSceneToMarkdownBlock(scene: ParsedExcalidrawScene): string {
  return `\`\`\`json\n${JSON.stringify(scene, null, 2)}\n\`\`\`\n`
}

export function suggestMindmapOutputPathBlock(inputPath: string): string {
  const lastSlash = inputPath.lastIndexOf('/')
  const dir = lastSlash >= 0 ? inputPath.slice(0, lastSlash) : ''
  const filename = lastSlash >= 0 ? inputPath.slice(lastSlash + 1) : inputPath
  const stem = filename.replace(/\.md$/i, '')
  const outputName = `${stem} (mindmap full text).excalidraw.md`
  return dir ? `${dir}/${outputName}` : outputName
}
