import { describe, expect, it } from 'vitest'
import { cleanTranscript } from '@/services/lego_blocks/transcriptCleanerBlock'

describe('transcriptCleanerBlock', () => {
  it('parses top heading rows with standalone timestamp transcript blocks', () => {
    const input = [
      '0:00 Intro',
      '0:42 What is good footwork?',
      '',
      '00:00:00',
      'I watch a ton of climbing content.',
      '',
      '00:00:45',
      'This section explains what good footwork is.',
    ].join('\n')

    const cleaned = cleanTranscript(input)

    expect(cleaned).toContain('## Intro')
    expect(cleaned).toContain('## What is good footwork?')
    expect(cleaned).toContain('• I watch a ton of climbing content.')
    expect(cleaned).toContain('• This section explains what good footwork is.')
  })

  it('parses standalone timestamp-only lines when headings are provided separately', () => {
    const transcript = [
      '00:00:00',
      'I watch a ton.',
      '',
      '00:00:28',
      'Explain them.',
    ].join('\n')
    const headings = [
      '0:00 Intro',
      '0:42 What is good footwork?',
    ].join('\n')

    const cleaned = cleanTranscript(transcript, headings)

    expect(cleaned.match(/^## Intro$/gm)).toHaveLength(1)
    expect(cleaned).toContain('• I watch a ton.')
    expect(cleaned).toContain('• Explain them.')
  })

  it('keeps support for parenthesized timestamp lines', () => {
    const transcript = [
      '(0s): Welcome to the session.',
      '(30s): Let us begin.',
    ].join('\n')

    const cleaned = cleanTranscript(transcript, '00:00:00 Intro')

    expect(cleaned).toContain('## Intro')
    expect(cleaned).toContain('• Welcome to the session.')
    expect(cleaned).toContain('• Let us begin.')
  })
})
