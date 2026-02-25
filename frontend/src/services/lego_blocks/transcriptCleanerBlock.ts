// TypeScript port of backend/app/tools/transcript_cleaner.py
// Pure text transform — no filesystem dependencies.

export interface TranscriptOptions {
  heading_level: number
}

const HEADING_LINE_RE = /^(?:\d{1,2}:)?\d{1,2}:\d{2}\s+.+$/
const TIMESTAMP_LINE_RE = /^\(([^)]+)\):\s*(.*)$/
const TIMESTAMP_ONLY_LINE_RE = /^((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$/
const INLINE_TIMESTAMP_RE = /^\s*(?:\(\s*[^)]+\s*\)|\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\s*:?\s*/
const TIMESTAMP_ANY_RE =
  /\(\s*\d+\s*h\s*\d+\s*m\s*\d+\s*s\s*\)|\(\s*\d+\s*m\s*\d+\s*s\s*\)|\(\s*\d+\s*s\s*\)|\b\d{1,2}:\d{2}:\d{2}\b|\b\d{1,2}:\d{2}\b/g

function parseTimeToSeconds(value: string): number | null {
  const v = value.trim()
  if (!v) return null

  if (v.includes(':')) {
    const parts = v.split(':')
    const nums = parts.map(Number)
    if (nums.some(isNaN)) return null
    if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2]
    if (nums.length === 2) return nums[0] * 60 + nums[1]
    return nums[0]
  }

  if (/[a-zA-Z]/.test(v)) {
    let h = 0, m = 0, s = 0
    const hMatch = v.match(/(\d+)\s*h/)
    if (hMatch) h = parseInt(hMatch[1], 10)
    const mMatch = v.match(/(\d+)\s*m/)
    if (mMatch) m = parseInt(mMatch[1], 10)
    const sMatch = v.match(/(\d+)\s*s/)
    if (sMatch) s = parseInt(sMatch[1], 10)
    return h * 3600 + m * 60 + s
  }

  if (/^\d+$/.test(v)) return parseInt(v, 10)

  return null
}

// Used for future features (currently unused, kept for parity with Python)
// function formatTime(seconds: number): string {
//   const h = Math.floor(seconds / 3600)
//   const m = Math.floor((seconds % 3600) / 60)
//   const s = seconds % 60
//   return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
// }

function extractHeadingLines(lines: string[]): [string[], string[]] {
  const headingLines: string[] = []
  const contentLines = [...lines]

  let i = lines.length - 1
  while (i >= 0 && !lines[i].trim()) i--

  while (i >= 0) {
    const line = lines[i].trim()
    if (!line) { i--; continue }
    if (HEADING_LINE_RE.test(line)) {
      headingLines.push(lines[i])
      i--
      continue
    }
    break
  }

  if (headingLines.length > 0) {
    headingLines.reverse()
    return [lines.slice(0, i + 1), headingLines]
  }

  // Also support transcripts where a heading list is provided at the top,
  // followed by timestamped transcript blocks.
  let j = 0
  while (j < lines.length && !lines[j].trim()) j++

  const topHeadingLines: string[] = []
  while (j < lines.length && HEADING_LINE_RE.test(lines[j].trim())) {
    topHeadingLines.push(lines[j])
    j++
  }

  if (topHeadingLines.length > 0) {
    while (j < lines.length && !lines[j].trim()) j++
    const remaining = lines.slice(j)
    const hasTimestampBlocks = remaining.some(line => {
      const trimmed = line.trim()
      return TIMESTAMP_LINE_RE.test(trimmed) || TIMESTAMP_ONLY_LINE_RE.test(trimmed)
    })
    if (hasTimestampBlocks) return [remaining, topHeadingLines]
  }

  return [contentLines, headingLines]
}

function parseHeadingMap(headingLines: string[]): Map<number, string> {
  const headings = new Map<number, string>()
  for (const line of headingLines) {
    const parts = line.trim().split(/\s+(.+)/)
    if (parts.length < 2) continue
    const ts = parts[0]
    const title = parts[1].trim()
    const seconds = parseTimeToSeconds(ts)
    if (seconds === null) continue
    headings.set(seconds, title)
  }
  return headings
}

function closestHeading(
  headings: Map<number, string>,
  timestamp: number,
): [number, string] | null {
  if (headings.has(timestamp)) return [timestamp, headings.get(timestamp)!]
  const earlier = [...headings.keys()].filter(t => t <= timestamp)
  if (earlier.length === 0) return null
  const t = Math.max(...earlier)
  return [t, headings.get(t)!]
}

export function cleanTranscript(
  transcriptText: string,
  headingsText?: string | null,
  options?: TranscriptOptions,
): string {
  const opts: TranscriptOptions = options ?? { heading_level: 2 }

  const transcriptLines = transcriptText.split('\n')
  let contentLines: string[]
  let headingLines: string[]

  if (headingsText && headingsText.trim()) {
    headingLines = headingsText.split('\n')
    contentLines = transcriptLines
  } else {
    ;[contentLines, headingLines] = extractHeadingLines(transcriptLines)
  }

  const headings = parseHeadingMap(headingLines)

  const blocks: Array<[number, string[]]> = []
  let currentTs: number | null = null
  let currentLines: string[] = []

  function flush() {
    if (currentTs === null) {
      currentLines = []
      return
    }
    const textLines = currentLines.map(ln => ln.trim()).filter(Boolean)
    blocks.push([currentTs, textLines])
    currentLines = []
  }

  for (const line of contentLines) {
    const trimmed = line.trim()
    const match = trimmed.match(TIMESTAMP_LINE_RE)
    if (match) {
      flush()
      const tsRaw = match[1]
      const remainder = match[2].trim()
      const tsSeconds = parseTimeToSeconds(tsRaw)
      currentTs = tsSeconds
      if (remainder) currentLines.push(remainder)
      continue
    }

    const tsOnlyMatch = trimmed.match(TIMESTAMP_ONLY_LINE_RE)
    if (tsOnlyMatch) {
      flush()
      currentTs = parseTimeToSeconds(tsOnlyMatch[1])
      continue
    }

    if (currentTs === null) continue
    const cleanedLine = line.replace(INLINE_TIMESTAMP_RE, '')
    currentLines.push(cleanedLine)
  }
  flush()

  const headingPrefix = '#'.repeat(Math.max(1, Math.min(6, opts.heading_level)))
  const outputLines: string[] = []
  let lastHeadingKey: number | null = null

  for (const [ts, blockLines] of blocks) {
    const heading = closestHeading(headings, ts)
    const headingKey = heading ? heading[0] : null
    let title = heading ? heading[1].trim() : ''
    title = title.replace(TIMESTAMP_ANY_RE, '').trim()
    if (!title) title = 'Section'

    if (headingKey !== lastHeadingKey) {
      outputLines.push(`${headingPrefix} ${title}`)
      lastHeadingKey = headingKey
    }

    if (blockLines.length > 0) {
      let paragraph = blockLines.join(' ')
      paragraph = paragraph.replace(TIMESTAMP_ANY_RE, '')
      paragraph = paragraph.replace(/\s{2,}/g, ' ').trim()
      outputLines.push(`\u2022 ${paragraph}`)
    }
    outputLines.push('')
  }

  return outputLines.join('\n').trim() + '\n'
}
