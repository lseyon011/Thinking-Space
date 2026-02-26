// TypeScript port of backend/app/tools/todo_scanner.py
// Uses VaultFS abstraction — works on web (via backend) or Capacitor (local fs).

import type { VaultFS, ListedFiles } from '@/services/lego_blocks/integrations/fsBlock'
import { EXCLUDED_DIRS, DATE_FILENAME_RE, extractSection } from '@/services/lego_blocks/units/vaultConstantsBlock'
import { createNote, generateKey, parseNote, stringifyNote, NODE_TYPE_LEVEL } from '@/services/lego_blocks/units/yamlNoteBlock'

const CHECKBOX_RE = /^- \[([ xX])\] (.+)$/

interface TodoItem {
  text: string
  checked: boolean
  line_number: number
}

// ── Find todo folders ──

async function findTodoFolders(fs: VaultFS): Promise<string[]> {
  const results: string[] = []

  async function walk(dir: string, relPrefix: string) {
    let listed: ListedFiles
    try {
      listed = await fs.list(dir)
    } catch {
      return
    }
    for (const name of listed.folders) {
      if (EXCLUDED_DIRS.has(name) || name.startsWith('.')) continue

      const relPath = relPrefix ? `${relPrefix}/${name}` : name
      const fullPath = dir ? `${dir}/${name}` : name

      if (name === 'todos') {
        results.push(relPath)
      }
      await walk(fullPath, relPath)
    }
  }

  await walk('', '')
  return results.sort()
}

// ── Parse a todo file ──

function parseTodoFile(content: string): TodoItem[] {
  const items: TodoItem[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(CHECKBOX_RE)
    if (m) {
      items.push({
        text: m[2].trim(),
        checked: m[1].toLowerCase() === 'x',
        line_number: i + 1,
      })
    }
  }
  return items
}

// ── Get todos for a month ──

export async function getTodosMonth(
  fs: VaultFS,
  year: number,
  month: number,
) {
  const todoFolders = await findTodoFolders(fs)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1)

  const dayTotals: Record<string, { total: number; done: number; pending: number }> = {}
  const sectionTotals: Record<string, { total: number; done: number; pending: number }> = {}
  const sectionDays: Record<string, Record<string, { total: number; done: number; pending: number }>> = {}

  for (const folderRel of todoFolders) {
    const section = extractSection(folderRel)

    let listed: ListedFiles
    try {
      listed = await fs.list(folderRel)
    } catch {
      continue
    }

    for (const fileName of listed.files) {
      if (!DATE_FILENAME_RE.test(fileName)) continue

      const dateStr = fileName.replace('.md', '')
      const fileDate = new Date(dateStr + 'T00:00:00')
      if (isNaN(fileDate.getTime())) continue
      if (fileDate < monthStart || fileDate >= monthEnd) continue

      let content: string
      try {
        content = await fs.read(`${folderRel}/${fileName}`)
      } catch {
        continue
      }

      const items = parseTodoFile(content)
      if (items.length === 0) continue

      const total = items.length
      const done = items.filter(it => it.checked).length
      const pending = total - done
      const dateKey = dateStr

      // Day aggregation
      if (!dayTotals[dateKey]) dayTotals[dateKey] = { total: 0, done: 0, pending: 0 }
      dayTotals[dateKey].total += total
      dayTotals[dateKey].done += done
      dayTotals[dateKey].pending += pending

      // Section aggregation
      if (!sectionTotals[section]) sectionTotals[section] = { total: 0, done: 0, pending: 0 }
      sectionTotals[section].total += total
      sectionTotals[section].done += done
      sectionTotals[section].pending += pending

      // Section-day aggregation
      if (!sectionDays[section]) sectionDays[section] = {}
      if (!sectionDays[section][dateKey]) sectionDays[section][dateKey] = { total: 0, done: 0, pending: 0 }
      sectionDays[section][dateKey].total += total
      sectionDays[section][dateKey].done += done
      sectionDays[section][dateKey].pending += pending
    }
  }

  // Build days list (all days in month)
  const days: Array<{ date: string; total: number; done: number; pending: number }> = []
  const cur = new Date(monthStart)
  while (cur < monthEnd) {
    const key = cur.toISOString().slice(0, 10)
    const d = dayTotals[key] ?? { total: 0, done: 0, pending: 0 }
    days.push({ date: key, ...d })
    cur.setDate(cur.getDate() + 1)
  }

  // Build sections list
  const sections = Object.entries(sectionTotals)
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.total - a.total)

  // Build section_days
  const sectionDaysOut: Record<string, Array<{ date: string; total: number; done: number; pending: number }>> = {}
  for (const [s, dateMap] of Object.entries(sectionDays)) {
    sectionDaysOut[s] = Object.entries(dateMap)
      .map(([d, counts]) => ({ date: d, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const grandTotal = days.reduce((s, d) => s + d.total, 0)
  const grandDone = days.reduce((s, d) => s + d.done, 0)
  const grandPending = days.reduce((s, d) => s + d.pending, 0)

  return {
    year,
    month,
    days,
    total: grandTotal,
    done: grandDone,
    pending: grandPending,
    sections,
    section_days: sectionDaysOut,
  }
}

// ── Get todos for specific sections in a month ──

export async function getTodosSectionMonth(
  fs: VaultFS,
  year: number,
  month: number,
  targetSections: string[],
) {
  const todoFolders = await findTodoFolders(fs)
  const sectionSet = new Set(targetSections)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1)

  const byDate: Record<string, Array<{
    text: string; checked: boolean; line: number; file: string; section: string
  }>> = {}

  for (const folderRel of todoFolders) {
    const section = extractSection(folderRel)
    if (!sectionSet.has(section)) continue

    let listed: ListedFiles
    try {
      listed = await fs.list(folderRel)
    } catch {
      continue
    }

    for (const fileName of listed.files) {
      if (!DATE_FILENAME_RE.test(fileName)) continue

      const dateStr = fileName.replace('.md', '')
      const fileDate = new Date(dateStr + 'T00:00:00')
      if (isNaN(fileDate.getTime())) continue
      if (fileDate < monthStart || fileDate >= monthEnd) continue

      const fileRel = `${folderRel}/${fileName}`
      let content: string
      try {
        content = await fs.read(fileRel)
      } catch {
        continue
      }

      const items = parseTodoFile(content)
      for (const it of items) {
        if (!byDate[dateStr]) byDate[dateStr] = []
        byDate[dateStr].push({
          text: it.text,
          checked: it.checked,
          line: it.line_number,
          file: fileRel,
          section,
        })
      }
    }
  }

  const days = Object.entries(byDate)
    .map(([d, items]) => ({ date: d, items }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return { sections: targetSections, days }
}

// ── Toggle a todo checkbox ──

export async function toggleTodo(
  fs: VaultFS,
  filePath: string,
  lineNumber: number,
) {
  let resultText = ''
  let resultChecked = false

  await fs.process(filePath, (content) => {
    const lines = content.split('\n')

    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Line ${lineNumber} out of range (file has ${lines.length} lines)`)
    }

    const line = lines[lineNumber - 1]
    const m = line.trim().match(CHECKBOX_RE)
    if (!m) throw new Error(`Line ${lineNumber} is not a checkbox line`)

    const leading = line.slice(0, line.length - line.trimStart().length)
    const wasChecked = m[1].toLowerCase() === 'x'
    resultText = m[2].trim()
    resultChecked = !wasChecked

    lines[lineNumber - 1] = wasChecked
      ? `${leading}- [ ] ${resultText}`
      : `${leading}- [x] ${resultText}`

    return lines.join('\n')
  })

  return {
    text: resultText,
    checked: resultChecked,
    line: lineNumber,
    file: filePath,
  }
}

// ── Create todos ──

export async function createTodo(
  fs: VaultFS,
  folderPath: string,
  dateStr: string,
  items: string[],
) {
  await fs.mkdir(folderPath)

  const filename = `${dateStr}.md`
  const filePath = `${folderPath}/${filename}`

  const newLines = items
    .filter(item => item.trim())
    .map(item => `- [ ] ${item.trim()}`)

  if (newLines.length === 0) throw new Error('No valid items provided')

  let content: string
  const now = new Date().toISOString()
  const defaultTitle = `Todos ${dateStr}`
  const todoKeyBase = generateKey(`${folderPath}-${dateStr}-todos`) || generateKey(`${dateStr}-todos`) || 'todos'
  const fileExists = await fs.exists(filePath)
  if (fileExists) {
    const existing = await fs.read(filePath)
    const parsed = parseNote(existing)

    if (parsed) {
      const note = parsed
      const fallback = createNote({
        type: 'thought',
        title: defaultTitle,
        tags: ['todo'],
        body: '',
      })

      note.frontmatter.uuid = nonEmpty(note.frontmatter.uuid) || fallback.frontmatter.uuid
      note.frontmatter.type = 'thought'
      note.frontmatter.level = NODE_TYPE_LEVEL.thought
      note.frontmatter.title = nonEmpty(note.frontmatter.title)
        ? note.frontmatter.title
        : defaultTitle
      note.frontmatter.key = nonEmpty(note.frontmatter.key)
        ? note.frontmatter.key
        : todoKeyBase
      note.frontmatter.status = note.frontmatter.status || 'active'
      note.frontmatter.created_at = nonEmpty(note.frontmatter.created_at)
        ? note.frontmatter.created_at
        : fallback.frontmatter.created_at
      note.frontmatter.updated_at = now
      note.frontmatter.tags = [...new Set([...(note.frontmatter.tags ?? []), 'todo'])]
      note.frontmatter.todo_date = dateStr

      let body = note.body
      if (body && !body.endsWith('\n')) body += '\n'
      note.body = body + newLines.join('\n') + '\n'
      content = stringifyNote(note)
    } else {
      let legacyBody = existing
      if (legacyBody && !legacyBody.endsWith('\n')) legacyBody += '\n'

      const note = createNote({
        type: 'thought',
        title: defaultTitle,
        tags: ['todo'],
        body: legacyBody + newLines.join('\n') + '\n',
      })
      note.frontmatter.key = todoKeyBase
      note.frontmatter.todo_date = dateStr
      content = stringifyNote(note)
    }
  } else {
    const note = createNote({
      type: 'thought',
      title: defaultTitle,
      tags: ['todo'],
      body: newLines.join('\n') + '\n',
    })
    note.frontmatter.key = todoKeyBase
    note.frontmatter.todo_date = dateStr
    content = stringifyNote(note)
  }

  await fs.write(filePath, content)

  return {
    output_path: filePath,
    items_added: newLines.length,
    appended: fileExists,
  }
}

function nonEmpty(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : ''
}
