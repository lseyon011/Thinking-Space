// buildPlistBlock is pure when given explicit stdoutPath/stderrPath in its
// context. The runtime caller (Electron main) lets these default via
// app.getPath('userData'), but for unit tests we pass them in so the function
// has no impure dependencies.

import { describe, expect, it, vi } from 'vitest'

const electronAppMock = { getPath: () => '/tmp' }
vi.mock('electron', () => ({ app: electronAppMock, default: { app: electronAppMock } }))

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
  electronBinary: '/Applications/Thinking Space.app/Contents/MacOS/Thinking Space',
  runnerPath: '/tmp/userData/schedules/runner.mjs',
  userDataPath: '/tmp/userData',
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

  it('ProgramArguments invokes electron binary against runner.mjs with run <key>', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({ key: 'foo-bar' }), CTX)
    expect(out).toContain('<string>/Applications/Thinking Space.app/Contents/MacOS/Thinking Space</string>')
    expect(out).toContain('<string>/tmp/userData/schedules/runner.mjs</string>')
    expect(out).toContain('<string>run</string>')
    expect(out).toContain('<string>foo-bar</string>')
  })

  it('sets ELECTRON_RUN_AS_NODE=1 and THINKING_SPACE_USERDATA in environment', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec(), CTX)
    expect(out).toMatch(/<key>ELECTRON_RUN_AS_NODE<\/key>\s*<string>1<\/string>/)
    expect(out).toMatch(/<key>THINKING_SPACE_USERDATA<\/key>\s*<string>\/tmp\/userData<\/string>/)
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

  it('emits StartCalendarInterval at start time for window trigger', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({
      schedule: {
        kind: 'window',
        start: { hour: 8, minute: 30 },
        stop: { hour: 17, minute: 0 },
        weekdays: [1, 5],
      },
    } as Partial<SpecLike>), CTX)
    expect(out).toContain('<key>StartCalendarInterval</key>')
    expect(out).toMatch(/<key>Hour<\/key><integer>8<\/integer>/)
    expect(out).toMatch(/<key>Minute<\/key><integer>30<\/integer>/)
    expect(out).toMatch(/<key>Weekday<\/key><integer>1<\/integer>/)
    expect(out).toMatch(/<key>Weekday<\/key><integer>5<\/integer>/)
    // stop time belongs to the stop plist, not the start plist
    expect(out).not.toMatch(/<key>Hour<\/key><integer>17<\/integer>/)
  })

  it('escapes XML special chars in the label', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec({ label: 'com.thinkingspace.<bad>&"x"' }), CTX)
    expect(out).toContain('com.thinkingspace.&lt;bad&gt;&amp;&quot;x&quot;')
    expect(out).not.toContain('com.thinkingspace.<bad>')
  })

  it('escapes XML special chars in paths', async () => {
    const { buildPlistBlock } = await loadPlistBlock()
    const out = buildPlistBlock(shellSpec(), { ...CTX, userDataPath: '/tmp/a&b<c' })
    expect(out).toContain('/tmp/a&amp;b&lt;c')
    expect(out).not.toContain('<string>/tmp/a&b<c</string>')
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

describe('launchdPlistBlock.buildWindowStopPlistBlock', () => {
  const windowSpec = () => shellSpec({
    schedule: {
      kind: 'window',
      start: { hour: 8, minute: 30 },
      stop: { hour: 17, minute: 0 },
      weekdays: [2],
    },
  } as Partial<SpecLike>)

  it('uses the .stop label suffix and fires at stop time', async () => {
    const { buildWindowStopPlistBlock, getStopLabelBlock } = await loadPlistBlock()
    const out = buildWindowStopPlistBlock(windowSpec(), CTX)
    expect(getStopLabelBlock(windowSpec())).toBe('com.thinkingspace.test.stop')
    expect(out).toMatch(/<key>Label<\/key>\s*<string>com\.thinkingspace\.test\.stop<\/string>/)
    expect(out).toContain('<string>stop</string>')
    expect(out).toMatch(/<key>Hour<\/key><integer>17<\/integer>/)
    expect(out).toMatch(/<key>Minute<\/key><integer>0<\/integer>/)
    expect(out).toMatch(/<key>Weekday<\/key><integer>2<\/integer>/)
  })

  it('throws for non-window schedules', async () => {
    const { buildWindowStopPlistBlock } = await loadPlistBlock()
    expect(() => buildWindowStopPlistBlock(shellSpec(), CTX)).toThrow(/window/)
  })
})
