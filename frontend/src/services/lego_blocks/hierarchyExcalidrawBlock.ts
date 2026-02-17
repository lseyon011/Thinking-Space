// Convert a hierarchy tree into Excalidraw elements for visual mindmap rendering.
// Generates rectangle nodes with text + arrow connections between parent/child.

import type { NodeRecord } from './dbBlock'
import type { ParsedExcalidrawScene } from './excalidrawFileBlock'

// ── Types ──

interface LayoutNode {
  record: NodeRecord
  x: number
  y: number
  width: number
  height: number
  children: LayoutNode[]
}

// ── Constants ──

const NODE_WIDTH = 200
const NODE_HEIGHT = 50
const H_GAP = 60    // horizontal gap between levels
const V_GAP = 20    // vertical gap between siblings
const PADDING_X = 40
const PADDING_Y = 40

const TYPE_COLORS: Record<string, string> = {
  program: '#a5d8ff',   // light blue
  epic: '#b2f2bb',      // light green
  idea_bucket: '#ffec99', // light yellow
  idea: '#ffd8a8',      // light orange
  thought_bucket: '#d0bfff', // light purple
  thought: '#eebefa',   // light pink
  task: '#ffe3e3',      // light red
  run: '#dbeafe',       // light blue
  handoff: '#f5d0fe',   // light fuchsia
}

const TYPE_STROKE_COLORS: Record<string, string> = {
  program: '#1971c2',
  epic: '#2f9e44',
  idea_bucket: '#e67700',
  idea: '#d9480f',
  thought_bucket: '#7048e8',
  thought: '#ae3ec9',
  task: '#c92a2a',
  run: '#1d4ed8',
  handoff: '#a21caf',
}

// ── Public API ──

/**
 * Convert a flat list of NodeRecords into an Excalidraw scene.
 * Builds a tree layout and generates rectangle + text + arrow elements.
 */
export function hierarchyToExcalidrawScene(nodes: NodeRecord[]): ParsedExcalidrawScene {
  if (nodes.length === 0) {
    return { elements: [], appState: { viewBackgroundColor: '#ffffff' } }
  }

  // Build tree structure
  const byKey = new Map<string, NodeRecord>()
  const childrenOf = new Map<string, NodeRecord[]>()

  for (const node of nodes) {
    byKey.set(node.key, node)
  }

  const roots: NodeRecord[] = []
  for (const node of nodes) {
    if (!node.parent || !byKey.has(node.parent)) {
      roots.push(node)
    } else {
      const siblings = childrenOf.get(node.parent) ?? []
      siblings.push(node)
      childrenOf.set(node.parent, siblings)
    }
  }

  // Sort roots and children by title
  roots.sort((a, b) => a.title.localeCompare(b.title))
  for (const [, children] of childrenOf) {
    children.sort((a, b) => a.title.localeCompare(b.title))
  }

  // Layout: compute positions
  const layoutRoots = roots.map(root => layoutTree(root, childrenOf, 0))

  // Stack roots vertically
  let globalY = PADDING_Y
  for (const layoutRoot of layoutRoots) {
    offsetTree(layoutRoot, PADDING_X, globalY)
    globalY += treeHeight(layoutRoot) + V_GAP * 2
  }

  // Generate Excalidraw elements
  const elements: unknown[] = []
  for (const layoutRoot of layoutRoots) {
    generateElements(layoutRoot, elements, null)
  }

  return {
    elements,
    appState: {
      viewBackgroundColor: '#ffffff',
      gridSize: 20,
    },
  }
}

/**
 * Generate an Excalidraw-compatible .md file content from hierarchy nodes.
 */
export function hierarchyToExcalidrawMd(nodes: NodeRecord[]): string {
  const scene = hierarchyToExcalidrawScene(nodes)
  const json = JSON.stringify(scene, null, 2)
  return `\`\`\`json\n${json}\n\`\`\`\n`
}

// ── Layout Algorithm ──

function layoutTree(
  record: NodeRecord,
  childrenOf: Map<string, NodeRecord[]>,
  depth: number,
): LayoutNode {
  const children = (childrenOf.get(record.key) ?? []).map(
    child => layoutTree(child, childrenOf, depth + 1),
  )

  const node: LayoutNode = {
    record,
    x: 0,
    y: 0,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    children,
  }

  return node
}

function treeHeight(node: LayoutNode): number {
  if (node.children.length === 0) return node.height

  let total = 0
  for (let i = 0; i < node.children.length; i++) {
    total += treeHeight(node.children[i])
    if (i < node.children.length - 1) total += V_GAP
  }
  return Math.max(node.height, total)
}

function offsetTree(node: LayoutNode, x: number, y: number): void {
  const height = treeHeight(node)
  node.x = x
  node.y = y + (height - node.height) / 2

  if (node.children.length > 0) {
    const childX = x + node.width + H_GAP
    let childY = y
    for (let i = 0; i < node.children.length; i++) {
      const childHeight = treeHeight(node.children[i])
      offsetTree(node.children[i], childX, childY)
      childY += childHeight + V_GAP
    }
  }
}

// ── Element Generation ──

let _idCounter = 0

function nextId(): string {
  _idCounter++
  return `hierarchy_${_idCounter}_${Date.now().toString(36)}`
}

/**
 * Reset the ID counter (useful for deterministic output in tests).
 */
export function resetIdCounter(): void {
  _idCounter = 0
}

function generateElements(
  node: LayoutNode,
  elements: unknown[],
  parentNode: LayoutNode | null,
): void {
  const bgColor = TYPE_COLORS[node.record.type] ?? '#f8f9fa'
  const strokeColor = TYPE_STROKE_COLORS[node.record.type] ?? '#495057'

  const rectId = nextId()
  const textId = nextId()

  // Rectangle element
  elements.push({
    id: rectId,
    type: 'rectangle',
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    strokeColor,
    backgroundColor: bgColor,
    fillStyle: 'solid',
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    angle: 0,
    roundness: { type: 3 },
    boundElements: [{ id: textId, type: 'text' }],
    isDeleted: false,
    groupIds: [],
    seed: Math.floor(Math.random() * 2000000000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2000000000),
  })

  // Truncate title for display
  const displayTitle = node.record.title.length > 24
    ? `${node.record.title.slice(0, 22)}...`
    : node.record.title
  const typeLabel = node.record.type.replace('_', ' ')

  // Text element (bound to rectangle)
  elements.push({
    id: textId,
    type: 'text',
    x: node.x + 10,
    y: node.y + 8,
    width: node.width - 20,
    height: node.height - 16,
    text: `${displayTitle}\n${typeLabel}`,
    fontSize: 14,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
    angle: 0,
    containerId: rectId,
    isDeleted: false,
    groupIds: [],
    originalText: `${displayTitle}\n${typeLabel}`,
    seed: Math.floor(Math.random() * 2000000000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2000000000),
  })

  // Arrow from parent to this node
  if (parentNode) {
    const arrowId = nextId()
    elements.push({
      id: arrowId,
      type: 'arrow',
      x: parentNode.x + parentNode.width,
      y: parentNode.y + parentNode.height / 2,
      width: node.x - (parentNode.x + parentNode.width),
      height: (node.y + node.height / 2) - (parentNode.y + parentNode.height / 2),
      points: [
        [0, 0],
        [
          node.x - (parentNode.x + parentNode.width),
          (node.y + node.height / 2) - (parentNode.y + parentNode.height / 2),
        ],
      ],
      strokeColor: '#868e96',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      angle: 0,
      roundness: { type: 2 },
      startBinding: null,
      endBinding: null,
      isDeleted: false,
      groupIds: [],
      seed: Math.floor(Math.random() * 2000000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
    })
  }

  // Recurse for children
  for (const child of node.children) {
    generateElements(child, elements, node)
  }
}
