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
const CHAPTER_SECTION_RE = /^##\s+Chapter\s+(\d+)(?::\s*(.+))?$/i
const CONTENTS_HEADING_RE = /^(?:#{1,6}\s*)?(?:table of contents|contents|index)\s*$/i
const INDEX_DOT_LEADER_RE = /\.{2,}\s*\d+\s*$/
const CHAPTER_PART_WORD_LIMIT = 2000
// Used for future split_long_paragraphs feature
// const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z"\u201c\u201d(])/

function countWords(text: string): number {
  const parts = text.trim().match(/\S+/g)
  return parts ? parts.length : 0
}

function cleanChapterTitle(raw: string): string {
  let title = raw.trim()
  title = title.replace(/\s*\.{2,}\s*\d+\s*$/, '')
  title = title.replace(/\s{2,}\d+\s*$/, '')
  return title.trim()
}

function parseIndexChapterEntry(line: string): { chapterNum: string; chapterTitle: string } | null {
  const stripped = line.trim()
  if (!stripped) return null
  const withoutMarker = stripped.replace(/^[-*•]\s+/, '')

  let m = withoutMarker.match(/^Chapter\s+(\d+)\s*[:.\-–]?\s*(.+)$/i)
  if (m) {
    const chapterTitle = cleanChapterTitle(m[2] ?? '')
    if (chapterTitle) return { chapterNum: m[1], chapterTitle }
  }

  m = withoutMarker.match(/^(\d{1,3})[.)]\s+(.+)$/)
  if (m) {
    const chapterTitle = cleanChapterTitle(m[2] ?? '')
    if (chapterTitle) return { chapterNum: m[1], chapterTitle }
  }

  return null
}

function findFirstBodyChapterIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i += 1) {
    const stripped = lines[i].trim()
    if (!stripped) continue

    if (CHAPTER_LINE_RE.test(stripped)) return i

    const m = stripped.match(CHAPTER_RE)
    if (!m) continue

    // TOC/index chapter entries often have dot-leaders and page numbers.
    if (INDEX_DOT_LEADER_RE.test(stripped)) continue
    return i
  }
  return -1
}

function collectIndexChapterHints(lines: string[]): Map<string, string> {
  const hints = new Map<string, string>()
  const firstBodyChapterIndex = findFirstBodyChapterIndex(lines)
  const limit = firstBodyChapterIndex > 0 ? firstBodyChapterIndex : Math.min(lines.length, 400)
  let inContentsSection = false

  for (let i = 0; i < limit; i += 1) {
    const stripped = lines[i].trim()
    if (!stripped) continue

    if (CONTENTS_HEADING_RE.test(stripped)) {
      inContentsSection = true
      continue
    }

    let chapterEntry = parseIndexChapterEntry(stripped)
    if (!chapterEntry) {
      const chapterOnly = stripped.match(/^Chapter\s+(\d+)\s*$/i)
      if (chapterOnly && i + 1 < limit) {
        const maybeTitle = cleanChapterTitle(lines[i + 1].trim())
        if (maybeTitle && !/^Chapter\s+\d+/i.test(maybeTitle)) {
          chapterEntry = { chapterNum: chapterOnly[1], chapterTitle: maybeTitle }
        }
      }
    }

    if (!chapterEntry) continue

    const shouldTrustHint = inContentsSection || INDEX_DOT_LEADER_RE.test(stripped) || /^Chapter\s+\d+/i.test(stripped)
    if (shouldTrustHint && !hints.has(chapterEntry.chapterNum)) {
      hints.set(chapterEntry.chapterNum, chapterEntry.chapterTitle)
    }
  }

  return hints
}

function looksLikeChapterTitleCandidate(line: string): boolean {
  const stripped = line.trim()
  if (!stripped) return false
  if (stripped.startsWith('#')) return false
  if (countWords(stripped) > 16) return false
  if (/[.!?]["'\u201d]?\s*$/.test(stripped)) return false
  return /[A-Za-z]/.test(stripped)
}

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

function normalizeBookStructure(lines: string[], chapterIndexHints: Map<string, string>): string[] {
  const out: string[] = []
  let i = 0
  const n = lines.length
  const firstBodyChapterIndex = findFirstBodyChapterIndex(lines)

  while (i < n) {
    const line = lines[i]
    const stripped = line.trim()

    // Skip TOC/index chapter list lines once hints are captured.
    if (i < firstBodyChapterIndex && (CONTENTS_HEADING_RE.test(stripped) || parseIndexChapterEntry(stripped))) {
      i++
      continue
    }

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
      let chapTitle = cleanChapterTitle(m.length >= 3 && m[2] ? m[2] : '')

      if (!chapTitle && i + 1 < n) {
        const nextLine = lines[i + 1].trim()
        if (
          nextLine
          && !nextLine.toUpperCase().startsWith('CHAPTER')
          && !PART_RE.test(nextLine)
          && looksLikeChapterTitleCandidate(nextLine)
        ) {
          chapTitle = cleanChapterTitle(nextLine)
          i++
        }
      }

      if (!chapTitle) {
        chapTitle = chapterIndexHints.get(chapNum) ?? ''
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

function splitIntoWordSegments(text: string, maxWords: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return [text.trim()]

  const segments: string[] = []
  for (let i = 0; i < words.length; i += maxWords) {
    segments.push(words.slice(i, i + maxWords).join(' '))
  }
  return segments
}

function trimBlankEdges(lines: string[]): string[] {
  const out = [...lines]
  while (out.length > 0 && !out[0].trim()) out.shift()
  while (out.length > 0 && !out[out.length - 1].trim()) out.pop()
  return out
}

function splitChapterBodyIntoChunks(lines: string[], maxWords: number): string[][] {
  const chunks: string[][] = []
  let currentChunk: string[] = []
  let currentWordCount = 0

  function flushChunk() {
    const trimmed = trimBlankEdges(currentChunk)
    if (trimmed.length > 0) chunks.push(trimmed)
    currentChunk = []
    currentWordCount = 0
  }

  for (const line of lines) {
    const stripped = line.trim()
    if (!stripped) {
      if (currentChunk.length > 0 && currentChunk[currentChunk.length - 1] !== '') {
        currentChunk.push('')
      }
      continue
    }

    if (stripped.startsWith('#') || stripped === '---') {
      currentChunk.push(line)
      continue
    }

    const isBullet = stripped.startsWith('\u2022 ')
    const textBody = isBullet ? stripped.slice(2).trim() : stripped
    const segments = splitIntoWordSegments(textBody, maxWords)

    for (const segment of segments) {
      const segmentWords = countWords(segment)
      if (segmentWords > 0 && currentWordCount > 0 && currentWordCount + segmentWords > maxWords) {
        flushChunk()
      }
      currentChunk.push(isBullet ? `\u2022 ${segment}` : segment)
      currentWordCount += segmentWords
      if (isBullet) {
        currentChunk.push('')
        currentChunk.push('')
      }
    }
  }

  flushChunk()
  return chunks
}

function splitChapterSections(lines: string[], maxWordsPerPart: number): string[] {
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const chapterMatch = lines[i].trim().match(CHAPTER_SECTION_RE)
    if (!chapterMatch) {
      out.push(lines[i])
      i++
      continue
    }

    const chapterNum = chapterMatch[1]
    out.push(lines[i])
    i++

    const chapterBody: string[] = []
    while (i < lines.length && !lines[i].trim().match(CHAPTER_SECTION_RE)) {
      chapterBody.push(lines[i])
      i++
    }

    const parts = splitChapterBodyIntoChunks(chapterBody, maxWordsPerPart)
    const safeParts = parts.length > 0 ? parts : [[]]

    for (let partIndex = 0; partIndex < safeParts.length; partIndex += 1) {
      out.push(`### Chapter ${chapterNum} Part ${partIndex + 1}`)
      const body = safeParts[partIndex]
      if (body.length > 0) out.push(...body)
      if (partIndex < safeParts.length - 1) out.push('')
    }
  }

  return out
}

export function formatMarkdown(text: string, options: FormatOptions): string {
  let lines = text.split('\n')

  if (options.strip_fences) {
    lines = stripStandaloneFences(lines)
  }

  const shouldNormalize = options.normalize_book && autoDetectBook(lines)

  if (shouldNormalize) {
    const chapterIndexHints = collectIndexChapterHints(lines)
    lines = normalizeBookStructure(lines, chapterIndexHints)
    lines = lines.join('\n').split('\n')
  }

  lines = demoteDeepHeadings(lines)
  lines = bulletizeParagraphs(lines, options.split_long_paragraphs, options.join_lines)
  lines = splitChapterSections(lines, CHAPTER_PART_WORD_LIMIT)

  let result = lines.join('\n')
  result = cleanExcessNewlines(result)
  if (!result.endsWith('\n')) result += '\n'
  return result
}
