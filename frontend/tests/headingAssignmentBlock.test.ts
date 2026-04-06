import { describe, expect, it } from 'vitest'
import {
  buildHeadingAssignmentDownloadNameBlock,
  buildHeadingAssignmentExportBlock,
  parseHeadingAssignmentValuesBlock,
  parseMarkdownHeadingsBlock,
} from '../src/personal_extension/services/lego_blocks/units/headingAssignmentBlock'

describe('headingAssignmentBlock', () => {
  it('parses markdown headings and skips fenced code blocks', () => {
    const headings = parseMarkdownHeadingsBlock([
      '# Alpha',
      '',
      '```ts',
      '## Ignore me',
      '```',
      '## Bravo ##',
      '### Charlie',
    ].join('\n'))

    expect(headings).toEqual([
      { id: 'heading-1-alpha', line: 1, level: 1, title: 'Alpha' },
      { id: 'heading-6-bravo', line: 6, level: 2, title: 'Bravo' },
      { id: 'heading-7-charlie', line: 7, level: 3, title: 'Charlie' },
    ])
  })

  it('preserves one exact selectable value per line', () => {
    expect(parseHeadingAssignmentValuesBlock('High\nMindset,About Company,Management of a company,\nHigh')).toEqual([
      'High',
      'Mindset,About Company,Management of a company,',
      'High',
    ])
  })

  it('builds pipe-delimited export text and escapes pipe characters', () => {
    const output = buildHeadingAssignmentExportBlock(
      [
        { id: 'heading-1-alpha', line: 1, level: 1, title: 'Alpha|One' },
        { id: 'heading-2-bravo', line: 2, level: 2, title: 'Bravo' },
      ],
      {
        'heading-1-alpha': 'High|Urgent',
        'heading-2-bravo': 'Low',
      },
      {
        'heading-1-alpha': ['Mindset', 'Compounders|Only'],
        'heading-2-bravo': [],
      },
    )

    expect(output).toBe([
      'Alpha\\|One|High\\|Urgent|Mindset, Compounders\\|Only',
      'Bravo|Low|',
    ].join('\n'))
  })

  it('builds a text download name from the selected markdown path', () => {
    expect(buildHeadingAssignmentDownloadNameBlock('notes/example file.md')).toBe('example file-heading-values.txt')
    expect(buildHeadingAssignmentDownloadNameBlock(null)).toBe('heading-values.txt')
  })
})
