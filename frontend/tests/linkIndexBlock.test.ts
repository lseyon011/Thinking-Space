import { describe, expect, it } from 'vitest'
import {
  extractLinksFromContentBlock,
  splitFrontmatterDocumentBlock,
  isLikelyYamlPathScalarBlock,
  findYamlCommentStartIndexBlock,
} from '@/services/lego_blocks/units/linkIndexBlock'

describe('splitFrontmatterDocumentBlock', () => {
  it('splits frontmatter from body', () => {
    const content = '---\ntitle: Test\n---\n# Body'
    const { frontmatter, body } = splitFrontmatterDocumentBlock(content)
    expect(frontmatter).toBe('---\ntitle: Test\n---\n')
    expect(body).toBe('# Body')
  })

  it('returns empty frontmatter when none present', () => {
    const content = '# Just a body'
    const { frontmatter, body } = splitFrontmatterDocumentBlock(content)
    expect(frontmatter).toBe('')
    expect(body).toBe(content)
  })
})

describe('isLikelyYamlPathScalarBlock', () => {
  it('detects relative paths', () => {
    expect(isLikelyYamlPathScalarBlock('./notes/foo.md')).toBe(true)
    expect(isLikelyYamlPathScalarBlock('../other/bar.md')).toBe(true)
  })

  it('detects paths with slashes', () => {
    expect(isLikelyYamlPathScalarBlock('notes/foo.md')).toBe(true)
  })

  it('detects paths with extensions', () => {
    expect(isLikelyYamlPathScalarBlock('readme.md')).toBe(true)
  })

  it('rejects YAML booleans', () => {
    expect(isLikelyYamlPathScalarBlock('true')).toBe(false)
    expect(isLikelyYamlPathScalarBlock('false')).toBe(false)
  })

  it('rejects numbers', () => {
    expect(isLikelyYamlPathScalarBlock('42')).toBe(false)
    expect(isLikelyYamlPathScalarBlock('3.14')).toBe(false)
  })

  it('rejects wikilinks and markdown links', () => {
    expect(isLikelyYamlPathScalarBlock('[[some link]]')).toBe(false)
    expect(isLikelyYamlPathScalarBlock('[label](url)')).toBe(false)
  })
})

describe('findYamlCommentStartIndexBlock', () => {
  it('finds comment after value', () => {
    expect(findYamlCommentStartIndexBlock('value # comment')).toBe(6)
  })

  it('returns -1 when no comment', () => {
    expect(findYamlCommentStartIndexBlock('value')).toBe(-1)
  })

  it('ignores hash inside quotes', () => {
    expect(findYamlCommentStartIndexBlock('"has # inside"')).toBe(-1)
    expect(findYamlCommentStartIndexBlock("'has # inside'")).toBe(-1)
  })
})

describe('extractLinksFromContentBlock', () => {
  const candidatePaths = [
    'notes/alpha.md',
    'notes/beta.md',
    'docs/gamma.md',
    'notes/deep/nested.md',
  ]

  it('extracts wikilinks', () => {
    const content = 'Some text [[alpha]] and [[beta|alias]]'
    const links = extractLinksFromContentBlock(content, 'notes/current.md', candidatePaths)
    const wikilinks = links.filter(l => l.linkType === 'wikilink')
    expect(wikilinks.length).toBe(2)
    expect(wikilinks[0].targetFilePath).toBe('notes/alpha.md')
    expect(wikilinks[1].targetFilePath).toBe('notes/beta.md')
  })

  it('extracts markdown links', () => {
    const content = 'See [link](./alpha.md) and [other](../docs/gamma.md)'
    const links = extractLinksFromContentBlock(content, 'notes/current.md', candidatePaths)
    const mdLinks = links.filter(l => l.linkType === 'markdown')
    expect(mdLinks.length).toBe(2)
    expect(mdLinks[0].targetFilePath).toBe('notes/alpha.md')
    expect(mdLinks[1].targetFilePath).toBe('docs/gamma.md')
  })

  it('skips external URLs in markdown links', () => {
    const content = 'See [link](https://example.com)'
    const links = extractLinksFromContentBlock(content, 'notes/current.md', candidatePaths)
    expect(links.filter(l => l.linkType === 'markdown')).toHaveLength(0)
  })

  it('extracts YAML path scalars', () => {
    const content = '---\nrelated: notes/alpha.md\n---\n# Body'
    const links = extractLinksFromContentBlock(content, 'notes/current.md', candidatePaths)
    const yamlLinks = links.filter(l => l.linkType === 'yaml')
    expect(yamlLinks.length).toBe(1)
    expect(yamlLinks[0].targetFilePath).toBe('notes/alpha.md')
  })

  it('handles content with no links', () => {
    const content = 'Just some plain text, no links here.'
    const links = extractLinksFromContentBlock(content, 'notes/current.md', candidatePaths)
    expect(links).toHaveLength(0)
  })

  it('handles mixed link types', () => {
    const content = '---\nref: notes/alpha.md\n---\nSee [[beta]] and [doc](../docs/gamma.md)'
    const links = extractLinksFromContentBlock(content, 'notes/current.md', candidatePaths)
    expect(links.length).toBeGreaterThanOrEqual(3)

    const types = new Set(links.map(l => l.linkType))
    expect(types.has('wikilink')).toBe(true)
    expect(types.has('markdown')).toBe(true)
    expect(types.has('yaml')).toBe(true)
  })

  it('handles wikilinks with headings and block refs', () => {
    const content = 'See [[alpha#heading]] and [[beta#^blockref]]'
    const links = extractLinksFromContentBlock(content, 'notes/current.md', candidatePaths)
    const wikilinks = links.filter(l => l.linkType === 'wikilink')
    expect(wikilinks.length).toBe(2)
    expect(wikilinks[0].targetFilePath).toBe('notes/alpha.md')
    expect(wikilinks[1].targetFilePath).toBe('notes/beta.md')
  })

  it('handles unresolvable wikilinks gracefully', () => {
    const content = 'See [[nonexistent]]'
    const links = extractLinksFromContentBlock(content, 'notes/current.md', candidatePaths)
    const wikilinks = links.filter(l => l.linkType === 'wikilink')
    expect(wikilinks).toHaveLength(0)
  })
})
