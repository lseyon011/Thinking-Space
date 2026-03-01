import { describe, expect, it } from 'vitest'
import {
  buildMarkdownTableFromRowsBlock,
  buildMarkdownTableTemplateBlock,
  detectAndParseDelimitedTableBlock,
  formatMarkdownTableAtSelectionBlock,
} from '@/services/orchestrators/markdownTableOrch'

describe('markdownTableOrch', () => {
  it('builds a default markdown table template', () => {
    const table = buildMarkdownTableTemplateBlock(3, 2)
    const lines = table.split('\n')
    expect(lines.length).toBe(4)
    expect(lines[0]).toContain('Column 1')
    expect(lines[1]).toContain('---')
  })

  it('parses CSV with quoted commas for paste conversion', () => {
    const input = 'Name,Comment\nMSFT,"range 610, 680"\nAAPL,steady'
    const parsed = detectAndParseDelimitedTableBlock(input)
    expect(parsed).not.toBeNull()
    expect(parsed?.delimiter).toBe(',')
    expect(parsed?.rows[0]).toEqual(['Name', 'Comment'])
    expect(parsed?.rows[1]).toEqual(['MSFT', 'range 610, 680'])
  })

  it('parses TSV for spreadsheet paste', () => {
    const input = 'Ticker\tCost\tPnL\nMSFT\t12345\t500\nAAPL\t9876\t-120'
    const parsed = detectAndParseDelimitedTableBlock(input)
    expect(parsed).not.toBeNull()
    expect(parsed?.delimiter).toBe('\t')
    expect(parsed?.rows[0]?.length).toBe(3)
  })

  it('returns null for non-tabular text', () => {
    const parsed = detectAndParseDelimitedTableBlock('just a sentence\nwith another line')
    expect(parsed).toBeNull()
  })

  it('builds markdown table content from parsed rows', () => {
    const markdown = buildMarkdownTableFromRowsBlock([
      ['Ticker', 'Cost'],
      ['MSFT', '12345'],
    ])
    expect(markdown).toContain('Ticker')
    expect(markdown).toContain('MSFT')
    expect(markdown).toContain('---')
  })

  it('formats an existing markdown table around selection', () => {
    const source = [
      '# Notes',
      '|Ticker|Cost|',
      '|---|---:|',
      '|MSFT|12345|',
      '',
    ].join('\n')
    const cursor = source.indexOf('MSFT')
    const formatted = formatMarkdownTableAtSelectionBlock(source, cursor, cursor)
    expect(formatted.value).toContain('| Ticker |  Cost |')
    expect(formatted.value).toContain('| ------ | ----: |')
    expect(formatted.value).toContain('| MSFT   | 12345 |')
  })

  it('leaves non-table selection unchanged when formatting', () => {
    const source = 'Simple markdown paragraph.'
    const formatted = formatMarkdownTableAtSelectionBlock(source, 0, 0)
    expect(formatted.value).toBe(source)
  })
})
