import { describe, expect, it } from 'vitest'
import {
  buildCodexUsageProbeErrorResultBlock,
  buildCodexUsageProbeLoadingResultBlock,
  detectCodexUsageProbeResultBlock,
  extractCodexUsageMetricsBlock,
  extractCodexUsageResetTextBlock,
  parseCodexUsageProbeSnapshotBlock,
} from '@/services/lego_blocks/units/codexUsageProbeBlock'

describe('codexUsageProbeBlock', () => {
  it('parses a raw probe snapshot', () => {
    expect(parseCodexUsageProbeSnapshotBlock({
      url: 'https://chatgpt.com',
      title: 'ChatGPT',
      bodyText: '  Hello   world  ',
      headings: [' Heading '],
      buttons: [' Continue '],
      alerts: [' Notice '],
      detectedAt: '2026-03-21T00:00:00.000Z',
    })).toEqual({
      url: 'https://chatgpt.com',
      title: 'ChatGPT',
      bodyText: 'Hello world',
      headings: ['Heading'],
      buttons: ['Continue'],
      alerts: ['Notice'],
      detectedAt: '2026-03-21T00:00:00.000Z',
    })
  })

  it('detects an OpenAI login page', () => {
    const result = detectCodexUsageProbeResultBlock('site-1', 'https://chatgpt.com', {
      url: 'https://chatgpt.com/auth/login',
      title: 'Welcome back',
      bodyText: 'Welcome back. Log in to continue with Google.',
      headings: ['Welcome back'],
      buttons: ['Log in', 'Continue with Google'],
      alerts: [],
      detectedAt: '2026-03-21T00:00:00.000Z',
    })
    expect(result.sessionState).toBe('needs_login')
    expect(result.sessionLabel).toBe('Needs login')
  })

  it('detects an OpenAI rate-limit banner and extracts visible usage text', () => {
    const result = detectCodexUsageProbeResultBlock('site-1', 'https://chatgpt.com', {
      url: 'https://chatgpt.com',
      title: 'ChatGPT',
      bodyText: 'Usage limit 0% remaining Resets Mar 26, 2026 4:53 PM. Code review 100% remaining.',
      headings: ['ChatGPT'],
      buttons: ['New chat'],
      alerts: ['Usage limit 0% remaining Resets Mar 26, 2026 4:53 PM. Code review 100% remaining.'],
      detectedAt: '2026-03-21T00:00:00.000Z',
    })
    expect(result.sessionState).toBe('rate_limited')
    expect(result.usageLabel).toContain('Usage limit 0% remaining')
    expect(extractCodexUsageMetricsBlock(result)).toEqual([
      { label: 'Usage Limit', remainingPercent: 0, tone: 'critical' },
      { label: 'Code Review', remainingPercent: 100, tone: 'healthy' },
    ])
    expect(extractCodexUsageResetTextBlock(result)).toContain('Resets Mar 26, 2026 4:53 PM')
  })

  it('detects an active OpenAI session and extracts an email account label when visible', () => {
    const result = detectCodexUsageProbeResultBlock('site-1', 'https://chatgpt.com', {
      url: 'https://chatgpt.com',
      title: 'ChatGPT',
      bodyText: 'researcher@example.com Limit resets after 2 hours.',
      headings: ['ChatGPT'],
      buttons: ['Upgrade plan'],
      alerts: [],
      detectedAt: '2026-03-21T00:00:00.000Z',
    })
    expect(result.sessionState).toBe('ready')
    expect(result.accountLabel).toBe('researcher@example.com')
    expect(result.usageLabel).toContain('resets after 2 hours')
  })

  it('falls back to generic detection for unknown providers', () => {
    const result = detectCodexUsageProbeResultBlock('site-1', 'https://example.com', {
      url: 'https://example.com',
      title: 'Example',
      bodyText: 'Example site',
      headings: ['Example'],
      buttons: [],
      alerts: [],
      detectedAt: '2026-03-21T00:00:00.000Z',
    })
    expect(result.provider).toBe('generic')
    expect(result.sessionState).toBe('unknown')
  })

  it('builds loading and error placeholders', () => {
    expect(buildCodexUsageProbeLoadingResultBlock('site-1').sessionState).toBe('loading')
    expect(buildCodexUsageProbeErrorResultBlock('site-1', 'boom').error).toBe('boom')
  })
})
