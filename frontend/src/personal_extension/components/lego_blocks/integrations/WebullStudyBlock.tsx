import { useCallback, useEffect, useState } from 'react'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { addGlobalSyncRefreshListenerBlock } from '@/services/lego_blocks/units/globalSyncRefreshBlock'
import {
  loadWebullStudySnapshotOrch,
  type WebullStudySnapshotOrch,
} from '../../../services/orchestrators/webullStudyOrch'
import WebullStudyTableBlock from './WebullStudyTableBlock'

function formatLoadedAtBlock(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function WebullStudyBlock() {
  const { openFile } = useMarkdownViewer()
  const [snapshot, setSnapshot] = useState<WebullStudySnapshotOrch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadWebullStudySnapshotOrch()
      setSnapshot(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return addGlobalSyncRefreshListenerBlock(() => {
      void refresh()
    })
  }, [refresh])

  const onOpenStudyFile = useCallback(
    (filePath: string) => openFile(filePath, { mode: 'view' }),
    [openFile],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        {snapshot ? (
          <>
            <span>{snapshot.rows.length} records</span>
            {snapshot.executionRoot && (
              <span className="ml-3 text-xs opacity-75">root: {snapshot.executionRoot}</span>
            )}
            <span className="ml-3 text-xs opacity-75">loaded: {formatLoadedAtBlock(snapshot.loadedAt)}</span>
            {snapshot.overallFetchedAt && (
              <span className="ml-3 text-xs opacity-75">
                webull cache: {formatLoadedAtBlock(snapshot.overallFetchedAt)}
              </span>
            )}
          </>
        ) : (
          <span>{loading ? 'Loading study records…' : 'No snapshot loaded.'}</span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {snapshot && snapshot.errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {snapshot.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {snapshot && snapshot.warnings.length > 0 && (
        <details className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <summary className="cursor-pointer text-xs font-medium">
            {snapshot.warnings.length} warning{snapshot.warnings.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1 list-disc pl-4 text-xs">
            {snapshot.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <WebullStudyTableBlock
        rows={snapshot?.rows ?? []}
        executionRoot={snapshot?.executionRoot ?? ''}
        onOpenStudyFile={onOpenStudyFile}
      />
    </div>
  )
}
