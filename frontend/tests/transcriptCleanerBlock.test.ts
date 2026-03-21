import { describe, expect, it } from 'vitest'
import { cleanTranscript } from '@/services/lego_blocks/units/transcriptCleanerBlock'

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

  it('parses compact timestamp lines with repeated duration text when headings are separate', () => {
    const transcript = [
      "0:00code's not even the right verb anymore,",
      '0:022 secondsright? But I have to um express my will to my agents for 16 hours a day manifest.',
      '0:077 secondsHow can I have not just a single session of clot code or codeex or some of these agent harnesses?',
      '0:1616 secondsNow the claw-like entities are taken for granted and now you can have multiple of them.',
      '0:3434 secondsHi listeners, welcome back to No Briars.',
      "0:3737 secondsToday I'm here with Andre Karpathy and we have a wide-ranging conversation for you about code agents.",
      '0:5656 secondsthanks for doing this. Yeah, thank you for having me.',
    ].join('\n')

    const headings = [
      '00:00 Andrej Karpathy Introduction',
      '02:55 What Capability Limits Remain?',
      '06:15 What Mastery of Coding Agents Looks Like',
    ].join('\n')

    const cleaned = cleanTranscript(transcript, headings)

    expect(cleaned).toContain('## Andrej Karpathy Introduction')
    expect(cleaned).toContain("• code's not even the right verb anymore,")
    expect(cleaned).toContain('• right? But I have to um express my will to my agents for 16 hours a day manifest.')
    expect(cleaned).toContain('• How can I have not just a single session of clot code or codeex or some of these agent harnesses?')
    expect(cleaned).toContain('• Hi listeners, welcome back to No Briars.')
    expect(cleaned).toContain("• thanks for doing this. Yeah, thank you for having me.")
    expect(cleaned).not.toContain('secondsright')
    expect(cleaned).not.toContain('secondsthanks')
  })

  it('strips embedded compact timestamp fragments from the cleaned paragraph output', () => {
    const transcript = [
      "0:00code's not even the right verb anymore, 0:022 secondsright? But I have to um express my will to my agents for 16 hours a day manifest. 0:077 secondsHow can I have not just a single session of clot code or codeex or some of these agent harnesses? How can I have more of them? How can I do that appropriately? 0:16The agent part is now taken for granted.",
    ].join('\n')

    const cleaned = cleanTranscript(transcript, '00:00 Andrej Karpathy Introduction')

    expect(cleaned).toContain("• code's not even the right verb anymore, right? But I have to um express my will to my agents for 16 hours a day manifest. How can I have not just a single session of clot code or codeex or some of these agent harnesses? How can I have more of them? How can I do that appropriately? The agent part is now taken for granted.")
    expect(cleaned).not.toContain('0:00')
    expect(cleaned).not.toContain('0:02')
    expect(cleaned).not.toContain('0:07')
    expect(cleaned).not.toContain('0:16')
    expect(cleaned).not.toContain('secondsHow')
  })
})
