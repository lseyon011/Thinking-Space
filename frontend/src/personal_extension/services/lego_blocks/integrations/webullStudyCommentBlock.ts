// Append a comment to a study .md file.
// Comments live in a "## Comments" body section at the end of the file.
// Each entry is a bullet of the form: `- YYYY-MM-DD HH:MM — text`.

import { readMarkdownDocument, saveMarkdownDocument } from '@/services/orchestrators/markdownDocumentsOrch'

function formatLocalTimestampBlock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function buildCommentLineBlock(text: string, now: Date): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  return `- ${formatLocalTimestampBlock(now)} — ${trimmed}`
}

function insertOrAppendCommentBlock(content: string, commentLine: string): string {
  const lines = content.split('\n')
  let commentsHeadingIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Comments\s*$/i.test(lines[i])) {
      commentsHeadingIdx = i
      break
    }
  }

  if (commentsHeadingIdx === -1) {
    // No comments section yet — append at end of file.
    const needsLeadingBlank = content.length > 0 && !content.endsWith('\n\n')
    const prefix = needsLeadingBlank ? (content.endsWith('\n') ? '\n' : '\n\n') : ''
    return `${content}${prefix}## Comments\n\n${commentLine}\n`
  }

  // Find end of comments section (next ##) and append before it.
  let endIdx = lines.length
  for (let j = commentsHeadingIdx + 1; j < lines.length; j++) {
    if (/^##\s+/.test(lines[j])) {
      endIdx = j
      break
    }
  }

  // Walk back from endIdx to skip trailing blank lines so we insert directly
  // after the last comment, then reattach the blanks.
  let insertAt = endIdx
  while (insertAt > commentsHeadingIdx + 1 && lines[insertAt - 1].trim() === '') {
    insertAt--
  }

  const before = lines.slice(0, insertAt)
  const after = lines.slice(insertAt)
  // Ensure exactly one blank line between heading and first bullet when the
  // section was previously empty.
  const headingIsLastBeforeInsert = insertAt === commentsHeadingIdx + 1
  const next = [
    ...before,
    ...(headingIsLastBeforeInsert ? [''] : []),
    commentLine,
    ...after,
  ]
  return next.join('\n')
}

export async function appendStudyCommentBlock(filePath: string, text: string): Promise<{
  output_path: string
  revision_path: string | null
  appendedLine: string
}> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Comment text is empty.')

  const current = await readMarkdownDocument(filePath)
  const commentLine = buildCommentLineBlock(trimmed, new Date())
  const nextContent = insertOrAppendCommentBlock(current.content, commentLine)
  if (nextContent === current.content) {
    // Defensive — shouldn't happen unless insertion logic mis-rendered.
    throw new Error('Failed to splice comment into study file.')
  }
  const result = await saveMarkdownDocument({
    path: filePath,
    content: nextContent,
    baseMtime: current.mtime,
    baseHash: current.hash,
    baseContent: current.content,
  })
  return {
    output_path: result.output_path,
    revision_path: result.revision_path,
    appendedLine: commentLine,
  }
}
