import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fsPromises from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  buildCLIInvokePayload,
  buildOrganizerContextFromArgs,
  installLocalStorageShim,
  materializeFileBackedInputs,
  parseOrganizerContextUrl,
  renderOrganizerContextHelp,
  renderCapabilityHelp,
  renderRunnerHelp,
  resolveCommandShortcut,
  resolveOutputFormat,
} from '../scripts/agent/capabilityRunner'

const ORIGINAL_VAULT_ROOT = process.env.LTM_VAULT_ROOT
const ORIGINAL_CALLER_CWD = process.env.THINKSPC_CALLER_CWD
const ORIGINAL_LOCAL_STORAGE_DESCRIPTOR = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

beforeEach(() => {
  process.env.LTM_VAULT_ROOT = '/tmp/ltm-runner-cli-test'
  process.env.THINKSPC_CALLER_CWD = '/tmp/ltm-runner-cli-test'
})

afterEach(() => {
  if (ORIGINAL_VAULT_ROOT === undefined) {
    delete process.env.LTM_VAULT_ROOT
  } else {
    process.env.LTM_VAULT_ROOT = ORIGINAL_VAULT_ROOT
  }
  if (ORIGINAL_CALLER_CWD === undefined) {
    delete process.env.THINKSPC_CALLER_CWD
  } else {
    process.env.THINKSPC_CALLER_CWD = ORIGINAL_CALLER_CWD
  }
  if (ORIGINAL_LOCAL_STORAGE_DESCRIPTOR) {
    Object.defineProperty(globalThis, 'localStorage', ORIGINAL_LOCAL_STORAGE_DESCRIPTOR)
  } else {
    delete (globalThis as { localStorage?: unknown }).localStorage
  }
})

describe('capabilityRunner CLI argument parsing', () => {
  it('maps deprecated --extra-comments to organizer.node.update comments with warning', () => {
    const { payload, warnings } = buildCLIInvokePayload('organizer.node.update', [
      '--uuid', 'node-123',
      '--extra-comments', 'Added implementation details',
    ])

    expect(payload.request.input).toEqual({
      uuid: 'node-123',
      updates: {
        comments: ['Added implementation details'],
      },
    })
    expect(warnings.some(msg => msg.includes('--extra-comments'))).toBe(true)
    expect(warnings.some(msg => msg.includes('comment.add'))).toBe(true)
  })

  it('keeps explicit metadata extras in extraFields for organizer.node.update', () => {
    const { payload, warnings } = buildCLIInvokePayload('organizer.node.update', [
      '--uuid', 'node-123',
      '--extra-record_kind', 'task',
    ])

    expect(payload.request.input).toEqual({
      uuid: 'node-123',
      updates: {
        extraFields: {
          record_kind: 'task',
        },
      },
    })
    expect(warnings).toEqual([])
  })

  it('maps deprecated --extra-description to organizer.node.create description', () => {
    const { payload, warnings } = buildCLIInvokePayload('organizer.node.create', [
      '--type', 'task',
      '--title', 'Parser hardening',
      '--extra-description', 'Short implementation plan',
    ])

    expect(payload.request.input).toMatchObject({
      type: 'task',
      title: 'Parser hardening',
      description: 'Short implementation plan',
    })
    expect(warnings.some(msg => msg.includes('--extra-description'))).toBe(true)
  })

  it('renders top-level help with usage and guidance', () => {
    const help = renderRunnerHelp()
    expect(help).toContain('./thinkspc [--text|--json] [--brief|--full] <command>')
    expect(help).toContain('./thinkspc help')
    expect(help).toContain('./thinkspc <capability> --help')
    expect(help).toContain('./thinkspc organizer.context --url')
    expect(help).toContain('Output defaults to text in terminals and json in non-interactive mode.')
    expect(help).toContain('Use comment.add for append-only task notes.')
  })

  it('parses organizer URL context with decoded project root', () => {
    const parsed = parseOrganizerContextUrl(
      'http://localhost:5173/thinking-space/thinking-organizer?tab=backlog&projectRoot=operations%2Fsfw',
    )
    expect(parsed.projectRoot).toBe('operations/sfw')
    expect(parsed.tab).toBe('backlog')
  })

  it('parses organizer hash-route context', () => {
    const parsed = parseOrganizerContextUrl(
      'http://localhost:5173/thinking-space/#/thinking-organizer?tab=backlog&projectRoot=ops%2Falpha',
    )
    expect(parsed.projectRoot).toBe('ops/alpha')
    expect(parsed.tab).toBe('backlog')
  })

  it('builds organizer context from args with defaults', () => {
    const context = buildOrganizerContextFromArgs([
      '--projectRoot', 'operations/sfw',
    ])
    expect(context.projectRoot).toBe('operations/sfw')
    expect(context.tab).toBe('backlog')
    expect(context.query).toBe('status active')
    expect(context.limit).toBe(10)
  })

  it('renders organizer context help', () => {
    const help = renderOrganizerContextHelp()
    expect(help).toContain('./thinkspc organizer.context --url')
    expect(help).toContain('Converts human organizer links into agent-native capability command suggestions.')
  })

  it('renders capability-specific help for organizer.node.update', () => {
    const help = renderCapabilityHelp('organizer.node.update')
    expect(help).toContain('Capability: organizer.node.update')
    expect(help).toContain('Update node metadata fields.')
    expect(help).toContain('./thinkspc organizer.node.update --uuid "abc-123" --status active --priority high')
    expect(help).toContain('./thinkspc organizer.node.update --uuid "abc-123" --description "Updated description"')
  })

  it('uses text output by default in TTY mode', () => {
    const resolved = resolveOutputFormat(['list'], { isTTY: true })
    expect(resolved.format).toBe('text')
    expect(resolved.verbosity).toBe('full')
    expect(resolved.args).toEqual(['list'])
  })

  it('uses json output by default in non-TTY mode', () => {
    const resolved = resolveOutputFormat(['list'], { isTTY: false })
    expect(resolved.format).toBe('json')
    expect(resolved.verbosity).toBe('full')
    expect(resolved.args).toEqual(['list'])
  })

  it('honors --json flag and removes it from args', () => {
    const resolved = resolveOutputFormat(['--json', 'organizer.nodes.search', '--query', 'active'], { isTTY: true })
    expect(resolved.format).toBe('json')
    expect(resolved.verbosity).toBe('full')
    expect(resolved.args).toEqual(['organizer.nodes.search', '--query', 'active'])
  })

  it('honors --brief and --full output verbosity flags', () => {
    const brief = resolveOutputFormat(['--brief', 'list'], { isTTY: true })
    expect(brief.verbosity).toBe('brief')
    expect(brief.args).toEqual(['list'])

    const full = resolveOutputFormat(['--full', 'list'], { isTTY: true })
    expect(full.verbosity).toBe('full')
    expect(full.args).toEqual(['list'])
  })

  it('does not consume capability --text argument when command is already selected', () => {
    const resolved = resolveOutputFormat(
      ['comment.add', '--uuid', 'abc-123', '--text', 'progress note'],
      { isTTY: true },
    )
    expect(resolved.format).toBe('text')
    expect(resolved.args).toEqual(['comment.add', '--uuid', 'abc-123', '--text', 'progress note'])
  })

  it('supports --flag=value syntax in CLI argument mode', () => {
    const { payload } = buildCLIInvokePayload('comment.add', [
      '--uuid=abc-123',
      '--text=progress update',
      '--addedBy=codex-gpt5',
    ])

    expect(payload.request.input).toEqual({
      uuid: 'abc-123',
      text: 'progress update',
      addedBy: 'codex-gpt5',
    })
  })

  it('accepts positional fallback text for comment.add', () => {
    const { payload, warnings } = buildCLIInvokePayload('comment.add', [
      '--uuid', 'abc-123',
      'progress', 'update', 'without', 'flag',
      '--addedBy', 'codex-gpt5',
    ])

    expect(payload.request.input).toEqual({
      uuid: 'abc-123',
      text: 'progress update without flag',
      addedBy: 'codex-gpt5',
    })
    expect(warnings.some(msg => msg.includes('Detected positional text for comment.add'))).toBe(true)
  })

  it('greedily parses natural language value for --text until next flag', () => {
    const { payload } = buildCLIInvokePayload('comment.add', [
      '--uuid', 'abc-123',
      '--text', 'Implementation', 'plan:', 'step', '1',
      '--addedBy', 'codex-gpt5',
    ])

    expect(payload.request.input).toEqual({
      uuid: 'abc-123',
      text: 'Implementation plan: step 1',
      addedBy: 'codex-gpt5',
    })
  })

  it('defaults comment.add addedBy to actor id', () => {
    const { payload } = buildCLIInvokePayload('comment.add', [
      '--uuid', 'abc-123',
      '--text', 'progress update',
      '--actor-id', 'codex-gpt5',
    ])

    expect(payload.request.input).toEqual({
      uuid: 'abc-123',
      text: 'progress update',
      addedBy: 'codex-gpt5',
    })
  })

  it('materializes --text-file into text payload input', async () => {
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'thinkspc-cli-'))
    const filePath = path.join(tempDir, 'note.txt')
    await fsPromises.writeFile(filePath, 'line 1\nline 2\n', 'utf-8')
    process.env.THINKSPC_CALLER_CWD = tempDir

    const input: Record<string, unknown> = {
      uuid: 'abc-123',
      'text-file': './note.txt',
    }
    await materializeFileBackedInputs(input)

    expect(input).toEqual({
      uuid: 'abc-123',
      text: 'line 1\nline 2',
    })
  })

  it('expands shortcut commands', () => {
    const done = resolveCommandShortcut('done', ['--uuid', 'abc-123'])
    expect(done.command).toBe('task.update_status')
    expect(done.args).toEqual(['--taskStatus', 'done', '--uuid', 'abc-123'])

    const comment = resolveCommandShortcut('comment', ['--uuid', 'abc-123', '--text', 'hello'])
    expect(comment.command).toBe('comment.add')
    expect(comment.args).toEqual(['--uuid', 'abc-123', '--text', 'hello'])
  })

  it('installs in-memory localStorage shim when runtime localStorage is unusable', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => null },
      configurable: true,
      enumerable: true,
      writable: true,
    })

    installLocalStorageShim()
    expect(typeof globalThis.localStorage.getItem).toBe('function')
    expect(typeof globalThis.localStorage.setItem).toBe('function')
    expect(typeof globalThis.localStorage.removeItem).toBe('function')
    expect(typeof globalThis.localStorage.clear).toBe('function')
  })
})
