import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listFolderEntries } from '@/services/orchestrators/fileSystemOrch'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { getNodeByPath } from '@/services/lego_blocks/integrations/dbBlock'
import { readNotebookSidecarBlock } from '@/services/lego_blocks/units/notebookSidecarBlock'
import { isImageDocumentPathBlock } from '@/services/lego_blocks/units/imageDocumentPathBlock'

interface NotebookEntryBase {
  path: string
  name: string
  kind: 'file' | 'folder'
  depth: number
  sortOrder: number | null
  children?: NotebookEntryBase[]
}

export interface NotebookEntry extends NotebookEntryBase {
  /** Sequential position (1-based) within the notebook */
  position: number
  children?: NotebookEntry[]
}

type NotebookFolderFilterBlock = (folderPath: string, depth: number) => boolean

async function loadEntriesRecursive(
  folderPath: string,
  depth: number,
  maxDepth: number,
  sidecarMap: Map<string, string[]>,
  includeFolder: NotebookFolderFilterBlock = () => true,
): Promise<NotebookEntryBase[]> {
  const { folders, files } = await listFolderEntries(folderPath)
  const entries: NotebookEntryBase[] = []

  // Read sidecar for this folder level
  const sidecarOrder = await readNotebookSidecarBlock(folderPath)
  if (sidecarOrder) {
    sidecarMap.set(folderPath, sidecarOrder)
  }

  // Folders first (matching explorer order)
  for (const folder of folders) {
    const fullPath = folderPath ? `${folderPath}/${folder}` : folder
    if (!includeFolder(fullPath, depth)) continue
    let children: NotebookEntryBase[] = []
    if (depth < maxDepth) {
      children = await loadEntriesRecursive(fullPath, depth + 1, maxDepth, sidecarMap, includeFolder)
    }
    entries.push({ path: fullPath, name: folder, kind: 'folder', depth, sortOrder: null, children })
  }

  // Files — skip images, look up sort_order from IndexedDB cache
  for (const file of files) {
    const fullPath = folderPath ? `${folderPath}/${file}` : file
    if (isImageDocumentPathBlock(fullPath)) continue
    let sortOrder: number | null = null
    try {
      const node = await getNodeByPath(fullPath)
      if (node?.sortOrder != null && Number.isFinite(node.sortOrder)) {
        sortOrder = node.sortOrder
      }
    } catch { /* ignore — IndexedDB may not have this file */ }
    entries.push({ path: fullPath, name: file, kind: 'file', depth, sortOrder })
  }

  return entries
}

/** Sort entries within each folder level: folders first (alpha), then files by sidecar order or sort_order */
function sortEntries(items: NotebookEntryBase[], sidecarMap: Map<string, string[]>): NotebookEntryBase[] {
  const folders = items.filter((e) => e.kind === 'folder')
  const files = items.filter((e) => e.kind === 'file')

  // Determine the parent folder path from the first file (all files at this level share a parent)
  const parentPath = files.length > 0
    ? (files[0].path.includes('/') ? files[0].path.slice(0, files[0].path.lastIndexOf('/')) : '')
    : null

  // Check if we have a sidecar ordering for this folder
  const sidecarOrder = parentPath !== null ? sidecarMap.get(parentPath) ?? null : null

  if (sidecarOrder) {
    // Use sidecar ordering — covers all file types including non-markdown
    const orderIndex = new Map(sidecarOrder.map((name, idx) => [name, idx]))
    files.sort((a, b) => {
      const aIdx = orderIndex.get(a.name) ?? Infinity
      const bIdx = orderIndex.get(b.name) ?? Infinity
      if (aIdx !== bIdx) return aIdx - bIdx
      return a.name.localeCompare(b.name)
    })
  } else {
    // Fallback: sort by YAML sort_order (markdown only)
    const hasSortOrder = files.some((f) => f.sortOrder !== null)
    if (hasSortOrder) {
      files.sort((a, b) => {
        const aOrder = a.sortOrder ?? Infinity
        const bOrder = b.sortOrder ?? Infinity
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.name.localeCompare(b.name)
      })
    }
    // else: keep alphabetical from listFolderEntries
  }

  // Recurse into folder children
  for (const folder of folders) {
    if (folder.children) {
      folder.children = sortEntries(folder.children, sidecarMap)
    }
  }

  return [...folders, ...files]
}

function assignPositions(raw: NotebookEntryBase[]): NotebookEntry[] {
  let pos = 0
  function walk(items: NotebookEntryBase[]): NotebookEntry[] {
    return items.map((item) => {
      pos += 1
      return {
        path: item.path,
        name: item.name,
        kind: item.kind,
        depth: item.depth,
        sortOrder: item.sortOrder,
        position: pos,
        ...(item.children ? { children: walk(item.children) } : {}),
      }
    })
  }
  return walk(raw)
}

/** Flatten the tree into a display-ordered list (folders as section headers, files as pages) */
export function flattenNotebookEntries(entries: NotebookEntry[]): NotebookEntry[] {
  const flat: NotebookEntry[] = []
  function walk(items: NotebookEntry[]) {
    for (const item of items) {
      flat.push(item)
      if (item.children) walk(item.children)
    }
  }
  walk(entries)
  return flat
}

/** Count only file entries (pages) */
export function countNotebookPages(entries: NotebookEntry[]): number {
  let count = 0
  function walk(items: NotebookEntry[]) {
    for (const item of items) {
      if (item.kind === 'file') count += 1
      if (item.children) walk(item.children)
    }
  }
  walk(entries)
  return count
}

export function useNotebookEntriesBlock(folderPath: string, maxDepth = 5) {
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadIdRef = useRef(0)

  const reload = useCallback(async () => {
    const id = ++loadIdRef.current
    setLoading(true)
    setError(null)
    try {
      const fs = getVaultFS()
      const exists = await fs.exists(folderPath)
      if (!exists) {
        if (id === loadIdRef.current) {
          setError('Folder not found.')
          setEntries([])
          setLoading(false)
        }
        return
      }
      const sidecarMap = new Map<string, string[]>()
      const raw = await loadEntriesRecursive(folderPath, 0, maxDepth, sidecarMap)
      const sorted = sortEntries(raw, sidecarMap)
      if (id === loadIdRef.current) {
        setEntries(assignPositions(sorted))
        setLoading(false)
      }
    } catch (err) {
      if (id === loadIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load folder.')
        setLoading(false)
      }
    }
  }, [folderPath, maxDepth])

  useEffect(() => {
    void reload()
  }, [reload])

  return { entries, loading, error, reload }
}

export function useExpandedNotebookEntriesBlock(expandedFolderPaths: string[]) {
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadIdRef = useRef(0)

  const normalizedExpandedPaths = useMemo(
    () => expandedFolderPaths
      .map((path) => path.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
      .filter((path) => path.length > 0)
      .sort(),
    [expandedFolderPaths],
  )

  const expandedPathsKey = normalizedExpandedPaths.join('\n')

  const reload = useCallback(async () => {
    const id = ++loadIdRef.current

    setLoading(true)
    setError(null)

    try {
      const expandedPathSet = new Set(normalizedExpandedPaths)
      const sidecarMap = new Map<string, string[]>()
      const raw = await loadEntriesRecursive(
        '',
        0,
        Number.MAX_SAFE_INTEGER,
        sidecarMap,
        (folderPath) => expandedPathSet.has(folderPath),
      )
      const sorted = sortEntries(raw, sidecarMap)

      if (id === loadIdRef.current) {
        setEntries(assignPositions(sorted))
        setLoading(false)
      }
    } catch (err) {
      if (id === loadIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load expanded folders.')
        setLoading(false)
      }
    }
  }, [normalizedExpandedPaths])

  useEffect(() => {
    void reload()
  }, [expandedPathsKey, reload])

  return { entries, loading, error, reload }
}
