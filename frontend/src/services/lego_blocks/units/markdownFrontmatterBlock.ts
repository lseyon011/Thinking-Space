import yaml from 'js-yaml'

export interface MarkdownFrontmatterNoteBlock {
  frontmatter: Record<string, unknown>
  body: string
  hasFrontmatter: boolean
}

export function splitMarkdownFrontmatterBlock(content: string): { frontmatterBlock: string; body: string } {
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines[0] !== '---') return { frontmatterBlock: '', body: normalized }

  let closingIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      closingIndex = index
      break
    }
  }

  if (closingIndex < 0) return { frontmatterBlock: '', body: normalized }

  return {
    frontmatterBlock: `${lines.slice(0, closingIndex + 1).join('\n')}\n`,
    body: lines.slice(closingIndex + 1).join('\n').replace(/^\n/, ''),
  }
}

export function parseMarkdownFrontmatterBlock(content: string): MarkdownFrontmatterNoteBlock {
  const { frontmatterBlock, body } = splitMarkdownFrontmatterBlock(content)
  if (!frontmatterBlock) {
    return {
      frontmatter: {},
      body: content.replace(/\r\n/g, '\n'),
      hasFrontmatter: false,
    }
  }

  const yamlText = frontmatterBlockToYamlText(frontmatterBlock)
  if (!yamlText.trim()) {
    return {
      frontmatter: {},
      body,
      hasFrontmatter: true,
    }
  }

  const parsed = yaml.load(yamlText)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Frontmatter must be a YAML object.')
  }

  return {
    frontmatter: { ...(parsed as Record<string, unknown>) },
    body,
    hasFrontmatter: true,
  }
}

export function stringifyMarkdownFrontmatterBlock(note: {
  frontmatter?: Record<string, unknown>
  body: string
}): string {
  const normalizedBody = note.body.replace(/\r\n/g, '\n')
  const frontmatter = sanitizeFrontmatterBlock(note.frontmatter ?? {})
  const keys = Object.keys(frontmatter)
  if (keys.length === 0) return normalizedBody

  const yamlText = yaml.dump(frontmatter, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    sortKeys: false,
  }).trimEnd()

  const lines = ['---', yamlText, '---', '']
  if (normalizedBody) lines.push(normalizedBody)
  return lines.join('\n')
}

export function patchFrontmatterValuesBlock(
  currentFrontmatter: Record<string, unknown>,
  params: {
    set?: Record<string, unknown>
    appendUnique?: Record<string, unknown>
  },
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...currentFrontmatter }

  for (const [key, value] of Object.entries(params.set ?? {})) {
    if (value === undefined) continue
    next[key] = value
  }

  for (const [key, value] of Object.entries(params.appendUnique ?? {})) {
    if (!Array.isArray(value)) {
      throw new Error(`append_unique.${key} must be an array.`)
    }
    const existing = Array.isArray(next[key]) ? [...(next[key] as unknown[])] : []
    const seen = new Set(existing.map(item => JSON.stringify(item)))
    for (const item of value) {
      const marker = JSON.stringify(item)
      if (seen.has(marker)) continue
      existing.push(item)
      seen.add(marker)
    }
    next[key] = existing
  }

  return next
}

function sanitizeFrontmatterBlock(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

function frontmatterBlockToYamlText(frontmatterBlock: string): string {
  const normalized = frontmatterBlock.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines[0]?.trim() === '---') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines[lines.length - 1]?.trim() === '---') lines.pop()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}
