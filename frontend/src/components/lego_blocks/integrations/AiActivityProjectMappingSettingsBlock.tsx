import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { useAiActivityBlock } from '@/components/lego_blocks/hooks/shared/useAiActivityBlock'
import { getProjectColor } from '@/components/lego_blocks/units/aiActivityColorsBlock'
import {
  newRuleIdBlock,
  readAiActivityMappingBlock,
  writeAiActivityMappingBlock,
  type AiActivityMappingSettings,
  type AiActivityProjectRule,
  type AiActivityRuleMode,
} from '@/services/lego_blocks/units/aiActivityMappingBlock'

const DEFAULT_NEW_COLOR = '#38bdf8'

function strokeToHex(stroke: string): string {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(stroke)
  if (!m) return DEFAULT_NEW_COLOR
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0')
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`
}

export default function AiActivityProjectMappingSettingsBlock() {
  const activity = useAiActivityBlock('all')
  const [settings, setSettings] = useState<AiActivityMappingSettings>(() => readAiActivityMappingBlock())

  const commit = (next: AiActivityMappingSettings) => {
    setSettings(writeAiActivityMappingBlock(next))
  }

  // Detected (post-mapping) projects, real ones first then noise/unknown.
  const projects = useMemo(() => {
    return [...activity.projects].sort((a, b) => {
      const rank = (p: typeof a) => (p.isUnknown ? 2 : p.isNoise ? 1 : 0)
      const r = rank(a) - rank(b)
      if (r !== 0) return r
      return b.totalMsgs - a.totalMsgs
    })
  }, [activity.projects])

  // The truth behind each project: which working directories its sessions ran
  // in. Read-only — shown so a wrong grouping is easy to diagnose and fix with
  // a rename/rule, without ever editing the detected paths themselves.
  const dirsByProject = useMemo(() => {
    const out = new Map<string, Map<string, number>>()
    for (const s of activity.sessions) {
      if (!s.cwd) continue
      const dirs = out.get(s.project) ?? new Map<string, number>()
      dirs.set(s.cwd, (dirs.get(s.cwd) ?? 0) + 1)
      out.set(s.project, dirs)
    }
    const top = new Map<string, { dir: string; extra: number }>()
    for (const [project, dirs] of out) {
      let best = ''
      let bestCount = 0
      for (const [dir, count] of dirs) {
        if (count > bestCount) { best = dir; bestCount = count }
      }
      top.set(project, { dir: best, extra: dirs.size - 1 })
    }
    return top
  }, [activity.sessions])

  const setColor = (name: string, hex: string | null) => {
    const colors = { ...settings.colors }
    if (hex) colors[name] = hex
    else delete colors[name]
    commit({ ...settings, colors })
  }

  // Rename keeps it precise: an exact rule old -> new. Re-renaming an already
  // renamed project updates that rule instead of stacking a new one.
  const renameProject = (current: string, nextName: string) => {
    const output = nextName.trim()
    if (!output || output === current) return
    const rules = [...settings.rules]
    const existing = rules.find(r => r.mode === 'exact' && (r.output === current || r.match === current))
    const colors = { ...settings.colors }
    if (colors[current] && !colors[output]) {
      colors[output] = colors[current]
      delete colors[current]
    }
    if (existing) {
      existing.output = output
    } else {
      rules.push({ id: newRuleIdBlock(), mode: 'exact', match: current, output, enabled: true })
    }
    commit({ ...settings, rules, colors })
  }

  const updateRule = (id: string, patch: Partial<AiActivityProjectRule>) => {
    commit({ ...settings, rules: settings.rules.map(r => (r.id === id ? { ...r, ...patch } : r)) })
  }

  const removeRule = (id: string) => {
    commit({ ...settings, rules: settings.rules.filter(r => r.id !== id) })
  }

  const addRule = () => {
    commit({
      ...settings,
      rules: [
        ...settings.rules,
        { id: newRuleIdBlock(), mode: 'contains', match: '', output: '', enabled: true },
      ],
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Activity Projects</CardTitle>
        <CardDescription>
          Projects are auto-detected from each session's working directory — the folder name becomes
          the project. The detected paths are the truth and aren't editable; if a name or grouping is
          wrong, fix it here: recolor, rename, or merge with rules. Changes apply instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Detected projects: color + rename */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Detected projects</h3>
          {activity.loading && projects.length === 0 && (
            <p className="text-xs text-muted-foreground">Loading activity…</p>
          )}
          {!activity.loading && projects.length === 0 && (
            <p className="text-xs text-muted-foreground/70">No AI activity found yet.</p>
          )}
          <div className="space-y-1.5">
            {projects.map(p => (
              <ProjectRow
                key={p.name}
                name={p.name}
                meta={`${p.totalChains} chain${p.totalChains === 1 ? '' : 's'} · ${p.totalMsgs} msg${p.totalMsgs === 1 ? '' : 's'}${p.isNoise ? ' · noise' : p.isUnknown ? ' · unknown' : ''}`}
                dirInfo={dirsByProject.get(p.name) ?? null}
                hasColorOverride={!!settings.colors[p.name]}
                onColor={hex => setColor(p.name, hex)}
                onResetColor={() => setColor(p.name, null)}
                onRename={next => renameProject(p.name, next)}
              />
            ))}
          </div>
        </div>

        {/* Advanced rules: merge / custom path mapping */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Mapping rules</h3>
            <Button type="button" size="sm" variant="outline" onClick={addRule}>
              Add rule
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Each session's detected name (and path) is tested against these in order; the first match
            sets the project. Use <span className="font-medium">is</span> for an exact rename/merge, or{' '}
            <span className="font-medium">contains</span> to catch a path/name fragment.
          </p>
          {settings.rules.length === 0 && (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
              No rules yet — detection runs as-is.
            </div>
          )}
          <div className="space-y-1.5">
            {settings.rules.map(rule => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onChange={patch => updateRule(rule.id, patch)}
                onRemove={() => removeRule(rule.id)}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ProjectRowProps {
  name: string
  meta: string
  /** Most common working directory for this project's sessions (read-only truth). */
  dirInfo: { dir: string; extra: number } | null
  hasColorOverride: boolean
  onColor: (hex: string) => void
  onResetColor: () => void
  onRename: (next: string) => void
}

function ProjectRow({ name, meta, dirInfo, hasColorOverride, onColor, onResetColor, onRename }: ProjectRowProps) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(name)
  const swatch = strokeToHex(getProjectColor(name).stroke)

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
      <input
        type="color"
        value={swatch}
        onChange={e => onColor(e.target.value)}
        className="h-6 w-6 shrink-0 cursor-pointer rounded border border-border/60 bg-transparent p-0"
        title="Set color"
        aria-label={`Color for ${name}`}
      />
      {renaming ? (
        <>
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { onRename(draft); setRenaming(false) }
              if (e.key === 'Escape') { setDraft(name); setRenaming(false) }
            }}
            className="h-8 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring"
            autoFocus
          />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { onRename(draft); setRenaming(false) }}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setDraft(name); setRenaming(false) }}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{meta}</div>
            {dirInfo && dirInfo.dir && (
              <div
                className="truncate font-mono text-[11px] text-muted-foreground/60"
                title={dirInfo.dir}
              >
                {dirInfo.dir}
                {dirInfo.extra > 0 ? ` · +${dirInfo.extra} more` : ''}
              </div>
            )}
          </div>
          {hasColorOverride && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onResetColor} title="Use the default color">
              Reset color
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDraft(name); setRenaming(true) }}>
            Rename
          </Button>
        </>
      )}
    </div>
  )
}

interface RuleRowProps {
  rule: AiActivityProjectRule
  onChange: (patch: Partial<AiActivityProjectRule>) => void
  onRemove: () => void
}

function RuleRow({ rule, onChange, onRemove }: RuleRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2">
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={e => onChange({ enabled: e.target.checked })}
        className="h-4 w-4 shrink-0 cursor-pointer"
        title={rule.enabled ? 'Enabled' : 'Disabled'}
        aria-label="Rule enabled"
      />
      <select
        value={rule.mode}
        onChange={e => onChange({ mode: e.target.value as AiActivityRuleMode })}
        className="h-8 rounded border border-input bg-background px-2 text-xs outline-none focus:border-ring"
      >
        <option value="exact">name is</option>
        <option value="contains">contains</option>
      </select>
      <input
        type="text"
        value={rule.match}
        onChange={e => onChange({ match: e.target.value })}
        placeholder={rule.mode === 'exact' ? 'detected name' : 'name or path fragment'}
        className="h-8 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring"
      />
      <span className="text-xs text-muted-foreground">→</span>
      <input
        type="text"
        value={rule.output}
        onChange={e => onChange({ output: e.target.value })}
        placeholder="project name"
        className="h-8 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring"
      />
      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={onRemove}>
        Remove
      </Button>
    </div>
  )
}
