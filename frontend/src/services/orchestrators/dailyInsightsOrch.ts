import { getVaultFS, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  createNote,
  parseNote,
  stringifyNote,
  type YAMLFrontmatter,
} from '@/services/lego_blocks/units/yamlNoteBlock'
import { todayIsoDate } from '@/services/lego_blocks/units/memorizedSessionsBlock'
import { syncSingleFile } from './vaultSyncOrch'

export const DAILY_INSIGHTS_FOLDER = 'lifeblood_systems/sfdl/insights'

export interface DailyInsightInput {
  insights: string[]
  files_touched?: string[]
  linked_notes?: string[]
  teachers_note?: string
  date?: string
  mode?: 'append' | 'replace'
}

export interface DailyInsightOutput {
  output_path: string
  was_created: boolean
  insights_count: number
}

function dedupePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

function renderBody(fm: YAMLFrontmatter): string {
  const lines: string[] = []
  const insights = Array.isArray(fm.insights) ? (fm.insights as string[]) : []
  const filesTouched = Array.isArray(fm.files_touched) ? (fm.files_touched as string[]) : []
  const linked = Array.isArray(fm.linked_notes) ? (fm.linked_notes as string[]) : []
  const teachers = typeof fm.teachers_note === 'string' ? (fm.teachers_note as string) : ''

  lines.push(`# Insights — ${fm.date ?? ''}`.trim())
  lines.push('')

  if (insights.length > 0) {
    lines.push('## Insights')
    for (const insight of insights) lines.push(`- ${insight}`)
    lines.push('')
  }

  if (filesTouched.length > 0) {
    lines.push('## Files touched')
    for (const f of filesTouched) lines.push(`- \`${f}\``)
    lines.push('')
  }

  if (linked.length > 0) {
    lines.push('## Linked notes')
    for (const l of linked) lines.push(`- ${l}`)
    lines.push('')
  }

  if (teachers.trim()) {
    lines.push('## Teacher’s note')
    lines.push(teachers.trim())
    lines.push('')
  }

  return lines.join('\n').replace(/\n{3,}$/, '\n')
}

export async function logDailyInsight(
  params: DailyInsightInput,
  fs: VaultFS = getVaultFS(),
): Promise<DailyInsightOutput> {
  const date = (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) ? params.date : todayIsoDate()
  const mode = params.mode ?? 'append'
  const folder = DAILY_INSIGHTS_FOLDER
  const filename = `${date}-insights.md`
  const outputPath = `${folder}/${filename}`
  const now = new Date().toISOString()

  const incoming = {
    insights: dedupePreserveOrder(params.insights ?? []),
    files_touched: dedupePreserveOrder(params.files_touched ?? []),
    linked_notes: dedupePreserveOrder(params.linked_notes ?? []),
    teachers_note: typeof params.teachers_note === 'string' ? params.teachers_note.trim() : '',
  }

  await fs.mkdir(folder)

  const existed = await fs.exists(outputPath)
  let note
  if (existed && mode === 'append') {
    const raw = await fs.read(outputPath)
    const parsed = parseNote(raw)
    if (parsed) {
      const fm = parsed.frontmatter
      const existingInsights = Array.isArray(fm.insights) ? (fm.insights as string[]) : []
      const existingFiles = Array.isArray(fm.files_touched) ? (fm.files_touched as string[]) : []
      const existingLinked = Array.isArray(fm.linked_notes) ? (fm.linked_notes as string[]) : []
      const existingTeachers = typeof fm.teachers_note === 'string' ? (fm.teachers_note as string) : ''

      fm.insights = dedupePreserveOrder([...existingInsights, ...incoming.insights])
      fm.files_touched = dedupePreserveOrder([...existingFiles, ...incoming.files_touched])
      fm.linked_notes = dedupePreserveOrder([...existingLinked, ...incoming.linked_notes])
      fm.teachers_note = incoming.teachers_note || existingTeachers
      fm.updated_at = now
      fm.date = date
      fm.record_kind = 'insight'
      parsed.body = renderBody(fm)
      note = parsed
    }
  }

  if (!note) {
    note = createNote({
      type: 'thought',
      title: `Insights — ${date}`,
      body: '',
    })
    note.frontmatter.record_kind = 'insight'
    note.frontmatter.date = date
    note.frontmatter.insights = incoming.insights
    note.frontmatter.files_touched = incoming.files_touched
    note.frontmatter.linked_notes = incoming.linked_notes
    if (incoming.teachers_note) note.frontmatter.teachers_note = incoming.teachers_note
    note.frontmatter.created_at = now
    note.frontmatter.updated_at = now
    note.body = renderBody(note.frontmatter)
  }

  await fs.write(outputPath, stringifyNote(note))
  await syncSingleFile(outputPath, fs)

  const insightsCount = Array.isArray(note.frontmatter.insights)
    ? (note.frontmatter.insights as string[]).length
    : 0

  return {
    output_path: outputPath,
    was_created: !existed,
    insights_count: insightsCount,
  }
}
