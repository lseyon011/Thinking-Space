import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import { Button } from '@/components/lego_blocks/units/ui/button'
import {
  getNativeAiSessionRoots,
  setNativeAiSessionRoots,
  type NativeAiSessionRoots,
} from '@/services/lego_blocks/integrations/nativeAiSessionsBlock'
import {
  DEFAULT_VAULT_SESSION_PREFIXES,
  readVaultSessionPrefixesBlock,
  writeVaultSessionPrefixesBlock,
} from '@/services/lego_blocks/units/aiActivitySourcesBlock'
import { clearAiActivitySnapshot } from '@/services/lego_blocks/integrations/aiActivityCacheBlock'

export default function AiActivitySessionSourcesSettingsBlock() {
  const [roots, setRoots] = useState<NativeAiSessionRoots | null>(null)
  const [rootsUnavailable, setRootsUnavailable] = useState(false)
  const [prefixes, setPrefixes] = useState<string[]>(() => readVaultSessionPrefixesBlock())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getNativeAiSessionRoots().then(result => {
      if (cancelled) return
      if (result) setRoots(result)
      else setRootsUnavailable(true)
    })
    return () => { cancelled = true }
  }, [])

  const saveRoot = async (source: 'claude' | 'codex', value: string | null) => {
    setError(null)
    try {
      const next = await setNativeAiSessionRoots({ [source]: value })
      setRoots(next)
      clearAiActivitySnapshot()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const savePrefixes = (raw: string) => {
    const next = writeVaultSessionPrefixesBlock(
      raw.split('\n').map(line => line.trim()).filter(Boolean),
    )
    setPrefixes(next)
    clearAiActivitySnapshot()
  }

  const resetPrefixes = () => {
    const next = writeVaultSessionPrefixesBlock([...DEFAULT_VAULT_SESSION_PREFIXES])
    setPrefixes(next)
    clearAiActivitySnapshot()
  }

  const prefixesAreDefault =
    prefixes.length === DEFAULT_VAULT_SESSION_PREFIXES.length
    && prefixes.every((p, i) => p === DEFAULT_VAULT_SESSION_PREFIXES[i])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session sources</CardTitle>
        <CardDescription>
          Where AI activity reads session transcripts from. Native stores are the JSONL
          transcripts each CLI writes on this machine; vault folders hold the markdown copies
          saved into your vault. Changes apply on the next activity refresh.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Native session stores</h3>
          {rootsUnavailable && (
            <p className="text-xs text-muted-foreground/70">
              Not available on this platform — native stores can only be read by the desktop app.
            </p>
          )}
          {!rootsUnavailable && !roots && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {roots && (
            <div className="space-y-1.5">
              <NativeRootRow
                label="Claude Code"
                value={roots.claude}
                defaultValue={roots.claudeDefault}
                onSave={value => saveRoot('claude', value)}
              />
              <NativeRootRow
                label="Codex"
                value={roots.codex}
                defaultValue={roots.codexDefault}
                onSave={value => saveRoot('codex', value)}
              />
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Vault transcript folders</h3>
            {!prefixesAreDefault && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={resetPrefixes}>
                Reset to defaults
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Vault-relative folder prefixes scanned for saved session markdown, one per line.
          </p>
          <PrefixesEditor value={prefixes} onSave={savePrefixes} />
        </div>
      </CardContent>
    </Card>
  )
}

interface NativeRootRowProps {
  label: string
  value: string
  defaultValue: string
  onSave: (value: string | null) => void
}

function NativeRootRow({ label, value, defaultValue, onSave }: NativeRootRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const isDefault = value === defaultValue

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
      {editing ? (
        <>
          <span className="shrink-0 text-sm font-medium text-foreground">{label}</span>
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { onSave(draft); setEditing(false) }
              if (e.key === 'Escape') { setDraft(value); setEditing(false) }
            }}
            placeholder={defaultValue}
            className="h-8 min-w-0 flex-1 rounded border border-input bg-background px-2 font-mono text-xs outline-none focus:border-ring"
            autoFocus
          />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { onSave(draft); setEditing(false) }}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setDraft(value); setEditing(false) }}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground" title={value}>
              {value}
            </div>
            {!isDefault && (
              <div className="truncate font-mono text-[11px] text-muted-foreground/50" title={defaultValue}>
                default: {defaultValue}
              </div>
            )}
          </div>
          {!isDefault && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onSave(null)} title="Use the default location">
              Reset
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDraft(value); setEditing(true) }}>
            Change
          </Button>
        </>
      )}
    </div>
  )
}

function PrefixesEditor({ value, onSave }: { value: string[]; onSave: (raw: string) => void }) {
  const joined = value.join('\n')
  const [draft, setDraft] = useState(joined)
  // Re-sync the textarea when the stored value changes from outside (e.g. reset).
  const [lastSynced, setLastSynced] = useState(joined)
  if (joined !== lastSynced) {
    setLastSynced(joined)
    setDraft(joined)
  }
  const dirty = draft !== joined

  return (
    <div className="space-y-1.5">
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={Math.max(3, value.length + 1)}
        spellCheck={false}
        className="w-full rounded border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-ring"
        aria-label="Vault transcript folder prefixes"
      />
      {dirty && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave(draft)}>
            Save folders
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDraft(joined)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
