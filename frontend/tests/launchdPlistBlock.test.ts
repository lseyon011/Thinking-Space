// buildPlistBlock is pure when given explicit stdoutPath/stderrPath in its
// context. The runtime caller (Electron main) lets these default via
// app.getPath('userData'), but for unit tests we pass them in so the function
// has no impure dependencies.

import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))

async function loadPlistBlock() {
  return import('../electron/src/lego_blocks/launchdPlistBlock')
}

type SpecLike = Parameters<Awaited<ReturnType<typeof loadPlistBlock>>['buildPlistBlock']>[0]

function shellSpec(overrides: Partial<SpecLike> = {}): SpecLike {
  return {
    key: 'test',
    label: 'com.thinkingspace.test',
    title: 'Test',
    enabled: true,
    execution: { kind: 'shell', command: '/bin/echo', args: ['hi'] },
    schedule: { kind: 'calendar', entries: [{ hour: 9, minute: 0 }] },
    managedBy: 'thinking-space',
    createdAt: '2026-05-22T00:00:00Z',
    updatedAt: '2026-05-22T00:00:00Z',
    ...overrides,
  } as SpecLike
}

const CTX = {
  baseUrl: 'http://127.0.0.1:64188',
  secret: 'abc123' + 'x'.repeat(58),
  stdoutPath: '/tmp/test.out.log',
  stderrPath: '/tmp/test.err.log',
}

describe('launchdPlistBlock.buildPlistBlock', () => {
  it('emits valid plist XML preamble + dict', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec(), CTX)
    expect(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(out).toContain('<!DOCTYPE plist')
    expect(out).toContain('<plist version="1.0">')
    expect(out).toContain('<dict>')
    expect(out).toContain('</dict>')
    expect(out).toContain('</plist>')
  })

  it('includes the schedule label', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({ label: 'com.example.foo' }), CTX)
    expect(out).toMatch(/<key>Label<\/key>\s*<string>com\.example\.foo<\/string>/)
  })

  it('ProgramArguments is curl POST to /schedules/<key>/fire with secret header', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({ key: 'foo-bar' }), CTX)
    expect(out).toContain('<string>/usr/bin/curl</string>')
    expect(out).toContain('<string>POST</string>')
    expect(out).toContain(`<string>X-Schedule-Secret: ${CTX.secret}</string>`)
    expect(out).toContain(`<string>${CTX.baseUrl}/schedules/foo-bar/fire</string>`)
  })

  it('emits StartCalendarInterval for calendar trigger', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({
      schedule: { kind: 'calendar', entries: [{ hour: 12, minute: 0 }, { hour: 23, minute: 30 }] },
    }), CTX)
    expect(out).toContain('<key>StartCalendarInterval</key>')
    expect(out).toMatch(/<key>Hour<\/key><integer>12<\/integer>/)
    expect(out).toMatch(/<key>Minute<\/key><integer>0<\/integer>/)
    expect(out).toMatch(/<key>Hour<\/key><integer>23<\/integer>/)
    expect(out).toMatch(/<key>Minute<\/key><integer>30<\/integer>/)
    expect(out).not.toContain('<key>StartInterval</key>')
  })

  it('emits weekday key when entry includes weekday', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({
      schedule: { kind: 'calendar', entries: [{ hour: 9, minute: 0, weekday: 1 }] },
    }), CTX)
    expect(out).toMatch(/<key>Weekday<\/key><integer>1<\/integer>/)
  })

  it('emits StartInterval for interval trigger', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({
      schedule: { kind: 'interval', seconds: 600 },
    }), CTX)
    expect(out).toContain('<key>StartInterval</key>')
    expect(out).toContain('<integer>600</integer>')
    expect(out).not.toContain('<key>StartCalendarInterval</key>')
  })

  it('escapes XML special chars in the label', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({ label: 'com.thinkingspace.<bad>&"x"' }), CTX)
    expect(out).toContain('com.thinkingspace.&lt;bad&gt;&amp;&quot;x&quot;')
    expect(out).not.toContain('com.thinkingspace.<bad>')
  })

  it('escapes XML special chars in the secret header value', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec(), { ...CTX, secret: 'a&b<c' })
    expect(out).toContain('X-Schedule-Secret: a&amp;b&lt;c')
  })

  it('RunAtLoad is false (never fire on bootstrap)', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec(), CTX)
    expect(out).toMatch(/<key>RunAtLoad<\/key>\s*<false\/>/)
  })

  it('uses explicit log paths when provided', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec(), {
      ...CTX,
      stdoutPath: '/my/custom/out.log',
      stderrPath: '/my/custom/err.log',
    })
    expect(out).toContain('<string>/my/custom/out.log</string>')
    expect(out).toContain('<string>/my/custom/err.log</string>')
  })
})
