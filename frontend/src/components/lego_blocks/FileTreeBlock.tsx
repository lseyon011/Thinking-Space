import ClickablePath from '@/components/lego_blocks/ClickablePathBlock'
import type { DayFile } from '@/services/lego_blocks/typesBlock'

export interface FileTreeNode {
  name: string
  created: DayFile[]
  modified: DayFile[]
  children: Record<string, FileTreeNode>
}

const DEPTH_STYLES = [
  'border-border/50 bg-muted/15',
  'border-border/35 bg-muted/10',
  'border-border/25 bg-muted/5',
  'border-border/15 bg-transparent',
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function countFiles(node: FileTreeNode): number {
  let n = node.created.length + node.modified.length
  for (const child of Object.values(node.children)) n += countFiles(child)
  return n
}

function FileList({ created, modified }: { created: DayFile[]; modified: DayFile[] }) {
  if (created.length === 0 && modified.length === 0) return null

  return (
    <div className="space-y-0.5 text-sm">
      {created.map((file) => (
        <div key={file.path} className="flex items-center justify-between gap-2 py-0.5 pl-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <ClickablePath path={file.path} className="truncate text-foreground/80">
              {fileName(file.path)}
            </ClickablePath>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatBytes(file.size_bytes)}
          </span>
        </div>
      ))}
      {modified.map((file) => (
        <div key={file.path} className="flex items-center justify-between gap-2 py-0.5 pl-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
            <ClickablePath path={file.path} className="truncate text-foreground/80">
              {fileName(file.path)}
            </ClickablePath>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatBytes(file.size_bytes)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function FileTreeView({ node, depth = 0 }: { node: FileTreeNode; depth?: number }) {
  const childEntries = Object.values(node.children).sort((a, b) => countFiles(b) - countFiles(a))
  const hasFiles = node.created.length > 0 || node.modified.length > 0
  const hasChildren = childEntries.length > 0

  if (!hasFiles && !hasChildren) return null

  if (depth === 0) {
    return (
      <div className="space-y-1.5">
        <FileList created={node.created} modified={node.modified} />
        {childEntries.map((child) => (
          <FileTreeView key={child.name} node={child} depth={1} />
        ))}
      </div>
    )
  }

  const style = DEPTH_STYLES[Math.min(depth - 1, DEPTH_STYLES.length - 1)]

  return (
    <div className={`rounded-lg border ${style} p-2 mt-1`}>
      <div className="text-xs font-medium text-muted-foreground/80 mb-1 truncate" title={node.name}>
        {node.name}
      </div>
      <FileList created={node.created} modified={node.modified} />
      {childEntries.map((child) => (
        <FileTreeView key={child.name} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function buildFileTree(created: DayFile[], modified: DayFile[], section: string): FileTreeNode {
  const root: FileTreeNode = { name: section, created: [], modified: [], children: {} }

  const insert = (file: DayFile, type: 'created' | 'modified') => {
    const parts = file.path.split('/')
    const sectionIdx = parts.indexOf(section)
    const subParts = sectionIdx >= 0 ? parts.slice(sectionIdx + 1) : parts
    subParts.pop()

    let current = root
    for (const dir of subParts) {
      if (!current.children[dir]) {
        current.children[dir] = { name: dir, created: [], modified: [], children: {} }
      }
      current = current.children[dir]
    }
    current[type].push(file)
  }

  for (const file of created) insert(file, 'created')
  for (const file of modified) insert(file, 'modified')
  return root
}
