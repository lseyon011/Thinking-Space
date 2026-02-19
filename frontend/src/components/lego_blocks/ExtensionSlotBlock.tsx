import { useEffect, useMemo, useState } from 'react'
import { Loader2, PlugZap } from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import {
  invokeExtensionSlotActionOrch,
  refreshExtensionUiOrch,
  resolveExtensionSlotActionsOrch,
  type ExtensionSlotActionView,
} from '@/services/orchestrators/extensionUiOrch'

export interface ExtensionSlotBlockProps {
  slotId: string
  context?: Record<string, unknown>
  className?: string
}

export default function ExtensionSlotBlock({ slotId, context, className }: ExtensionSlotBlockProps) {
  const [loading, setLoading] = useState(false)
  const [actions, setActions] = useState<ExtensionSlotActionView[]>([])
  const [unsupported, setUnsupported] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runningActionKey, setRunningActionKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        await refreshExtensionUiOrch()
        const resolved = resolveExtensionSlotActionsOrch(slotId)
        if (cancelled) return
        setActions(resolved.actions)
        setUnsupported(resolved.supported ? null : resolved.reason?.message ?? 'Unsupported slot target.')
      } catch (err) {
        if (cancelled) return
        // Fail closed and keep the slot hidden when extension discovery is unavailable.
        // This avoids noisy UI in flows where no extension runtime is configured yet.
        void err
        setError(null)
        setActions([])
        setUnsupported(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [slotId])

  const hasContent = useMemo(() => loading || !!unsupported || !!error || actions.length > 0, [
    loading,
    unsupported,
    error,
    actions.length,
  ])
  if (!hasContent) return null

  return (
    <div className={className}>
      <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <PlugZap className="h-3.5 w-3.5" />
          Extensions
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading extension actions...
          </div>
        )}

        {!loading && unsupported && (
          <p className="text-xs text-muted-foreground">{unsupported}</p>
        )}

        {!loading && !unsupported && error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {!loading && !unsupported && !error && actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map(action => (
              <Button
                key={action.actionKey}
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                title={action.description ?? action.label}
                disabled={runningActionKey === action.actionKey}
                onClick={() => {
                  void (async () => {
                    setError(null)
                    setRunningActionKey(action.actionKey)
                    try {
                      const result = await invokeExtensionSlotActionOrch({
                        slotId,
                        actionKey: action.actionKey,
                        context,
                      })
                      if (!result.ok) {
                        if ('blocked' in result && result.blocked && 'message' in result) {
                          setError(result.message)
                        } else if ('error' in result) {
                          setError(result.error.message)
                        } else {
                          setError('Extension action failed.')
                        }
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err))
                    } finally {
                      setRunningActionKey(null)
                    }
                  })()
                }}
              >
                {runningActionKey === action.actionKey ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
