// Resolve a chain (one or more sessions) to a single readable markdown
// transcript by concatenating each session's already-rendered vault md.
// Nothing is cached — the read happens on demand when the user opens the
// transcript modal. Sessions whose md isn't on disk get a placeholder block
// so a partial chain still renders something useful.

import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import type { ActivityChain } from '@/services/lego_blocks/units/aiActivityParserBlock'

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export async function getChainTranscriptBlock(chain: ActivityChain): Promise<string> {
  const fs = getVaultFS()
  // Sessions in display order — chronological.
  const ordered = [...chain.sessions].sort(
    (a, b) => Date.parse(a.startedIso) - Date.parse(b.startedIso),
  )
  const parts: string[] = []
  parts.push(
    `# ${chain.project} · ${ordered.length} session${ordered.length === 1 ? '' : 's'}`,
    '',
    `_${fmtWhen(chain.startedIso)} → ${fmtWhen(chain.endedIso ?? chain.startedIso)} · ${chain.msgCount} msgs_`,
    '',
  )
  for (let i = 0; i < ordered.length; i += 1) {
    const s = ordered[i]
    parts.push('---', '', `## Session ${i + 1} — ${s.topic || '(no topic)'}`, '')
    parts.push(`_${fmtWhen(s.startedIso)}${s.model ? ` · ${s.model}` : ''}_`, '')
    try {
      const content = await fs.read(s.path)
      // Strip the leading H1 that render-session.sh writes ("# Claude Code
      // Session — <uuid>") so the per-session heading we just emitted stays
      // the top-level scope marker.
      const trimmed = content.replace(/^# Claude Code Session[^\n]*\n+(_Last saved:[^\n]*_\n+)?/m, '')
      parts.push(trimmed)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      parts.push(`_Could not load session transcript at \`${s.path}\` — ${message}_`)
    }
    parts.push('')
  }
  return parts.join('\n')
}
