// TypeScript port of backend/app/tools/format_for_excalidraw.py
// Pure text transform — no filesystem dependencies.

export interface FormatOptions {
  normalize_book: boolean
  strip_fences: boolean
  split_long_paragraphs: boolean
  join_lines: boolean
}

const PART_RE = /^PART\s+[IVXLC]+\s*$/i
const CHAPTER_RE = /^(?:##\s*)?Chapter\s+(\d+)(?::\s*(.+))?$/i
const CHAPTER_LINE_RE = /^CHAPTER\s+(\d+)\s*$/i
// Used for future split_long_paragraphs feature
// const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z"\u201c\u201d(])/

function looksLikeParagraph(text: string): boolean {
  const wordCount = text.split(/\s+/).length
  if (wordCount >= 18) return true
  if (text.length >= 80) return true
  if ((text.match(/\./g) || []).length >= 2) return true
  if (text.length >= 50 && /[.]["'\u201d]?\s*$/.test(text)) return true
  return false
}

function demoteDeepHeadings(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const m = line.trim().match(/^(#{4,})\s+(.+)$/)
    if (!m) {
      out.push(line)
      continue
    }
    const content = m[2].trim()
    if (looksLikeParagraph(content)) {
      out.push(content)
    } else {
      out.push(line)
    }
  }
  return out
}

function normalizeBookStructure(lines: string[]): string[] {
  const out: string[] = []
  let i = 0
  const n = lines.length

  while (i < n) {
    const line = lines[i]
    const stripped = line.trim()

    // PART headers
    if (PART_RE.test(stripped)) {
      const partLine = stripped
      let title = ''
      if (i + 1 < n) {
        const nextLine = lines[i + 1].trim()
        if (nextLine && !nextLine.toUpperCase().startsWith('CHAPTER')) {
          title = nextLine
          i++
        }
      }
      if (title) {
        out.push(`\n---\n\n# ${partLine}: ${title}\n`)
      } else {
        out.push(`\n---\n\n# ${partLine}\n`)
      }
      i++
      continue
    }

    // CHAPTER headers
    let m = stripped.match(CHAPTER_RE)
    if (!m) m = stripped.match(CHAPTER_LINE_RE)
    if (m) {
      const chapNum = m[1]
      let chapTitle = m.length >= 3 ? m[2] : null

      if (!chapTitle && i + 1 < n) {
        const nextLine = lines[i + 1].trim()
        if (nextLine && !nextLine.toUpperCase().startsWith('CHAPTER')) {
          chapTitle = nextLine
          i++
        }
      }

      if (chapTitle) {
        out.push(`\n## Chapter ${chapNum}: ${chapTitle}\n`)
      } else {
        out.push(`\n## Chapter ${chapNum}\n`)
      }
      i++
      continue
    }

    out.push(line)
    i++
  }

  return out
}

function stripStandaloneFences(lines: string[]): string[] {
  return lines.filter(ln => ln.trim() !== '```')
}

function cleanExcessNewlines(text: string): string {
  return text.replace(/\n{4,}/g, '\n\n\n')
}

function autoDetectBook(lines: string[]): boolean {
  for (const line of lines) {
    const s = line.trim()
    if (PART_RE.test(s) || CHAPTER_RE.test(s) || CHAPTER_LINE_RE.test(s)) return true
  }
  return false
}

function normalizeBulletText(text: string): string {
  let cleaned = text.trim()
  while (cleaned.startsWith('\u2022 ')) {
    cleaned = cleaned.slice(2).trim()
  }
  return cleaned
}

function isParagraphEnd(line: string): boolean {
  const stripped = line.trimEnd()
  if (!stripped) return false
  return /[.!?]["'\u201c\u201d]?\s*$/.test(stripped)
}

function isParagraphStart(line: string): boolean {
  const stripped = line.trim()
  if (!stripped) return false
  return /^[A-Z]/.test(stripped)
}

function bulletizeParagraphs(lines: string[], _splitLong: boolean, _joinLines: boolean): string[] {
  const out: string[] = []
  let para: string[] = []

  function flushPara() {
    if (para.length === 0) return
    let text = para.map(s => s.trim()).filter(Boolean).join(' ')
    text = text.replace(/\s{2,}/g, ' ').trim()
    if (text) {
      out.push(`\u2022 ${text}`)
      out.push('')
      out.push('')
    }
    para = []
  }

  for (const line of lines) {
    const stripped = line.trim()

    if (!stripped) {
      flushPara()
      continue
    }

    if (stripped === '---') {
      flushPara()
      out.push(line)
      continue
    }

    if (stripped.startsWith('#')) {
      flushPara()
      out.push(line)
      continue
    }

    // Existing bullet (-, *, numbered)
    if (/^(\s*)(?:-|\*|\d+\.)\s+.+$/.test(line)) {
      flushPara()
      const text = line.replace(/^(\s*)(?:-|\*|\d+\.)\s+/, '').trim()
      out.push(`\u2022 ${normalizeBulletText(text)}`)
      out.push('')
      out.push('')
      continue
    }

    // Existing bullet (•)
    if (/^\s*\u2022\s+.+$/.test(line)) {
      flushPara()
      const text = line.replace(/^\s*\u2022\s+/, '').trim()
      out.push(`\u2022 ${normalizeBulletText(text)}`)
      out.push('')
      out.push('')
      continue
    }

    // Paragraph boundary detection
    if (para.length > 0 && isParagraphEnd(para[para.length - 1]) && isParagraphStart(stripped)) {
      flushPara()
    }

    para.push(line)
  }

  flushPara()
  return out
}

export function formatMarkdown(text: string, options: FormatOptions): string {
  let lines = text.split('\n')

  if (options.strip_fences) {
    lines = stripStandaloneFences(lines)
  }

  const shouldNormalize = options.normalize_book && autoDetectBook(lines)

  if (shouldNormalize) {
    lines = normalizeBookStructure(lines)
    lines = lines.join('\n').split('\n')
  }

  lines = demoteDeepHeadings(lines)
  lines = bulletizeParagraphs(lines, options.split_long_paragraphs, options.join_lines)

  let result = lines.join('\n')
  result = cleanExcessNewlines(result)
  if (!result.endsWith('\n')) result += '\n'
  return result
}
