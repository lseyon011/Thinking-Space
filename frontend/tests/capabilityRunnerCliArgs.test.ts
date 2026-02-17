import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildCLIInvokePayload,
  renderCapabilityHelp,
  renderRunnerHelp,
  resolveOutputFormat,
} from '../scripts/agent/capabilityRunner'

const ORIGINAL_VAULT_ROOT = process.env.LTM_VAULT_ROOT

beforeEach(() => {
  process.env.LTM_VAULT_ROOT = '/tmp/ltm-runner-cli-test'
})

afterEach(() => {
  if (ORIGINAL_VAULT_ROOT === undefined) {
    delete process.env.LTM_VAULT_ROOT
  } else {
    process.env.LTM_VAULT_ROOT = ORIGINAL_VAULT_ROOT
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
    expect(help).toContain('./ltm [--text|--json] <command>')
    expect(help).toContain('./ltm help')
    expect(help).toContain('./ltm <capability> --help')
    expect(help).toContain('Output defaults: text on TTY, json otherwise.')
    expect(help).toContain('Use comment.add for append-only task notes.')
  })

  it('renders capability-specific help for organizer.node.update', () => {
    const help = renderCapabilityHelp('organizer.node.update')
    expect(help).toContain('Capability: organizer.node.update')
    expect(help).toContain('Update node metadata fields.')
    expect(help).toContain('./ltm organizer.node.update --uuid "abc-123" --comments')
    expect(help).toContain('./ltm comment.add --uuid "abc-123" --text')
  })

  it('uses text output by default in TTY mode', () => {
    const resolved = resolveOutputFormat(['list'], { isTTY: true })
    expect(resolved.format).toBe('text')
    expect(resolved.args).toEqual(['list'])
  })

  it('uses json output by default in non-TTY mode', () => {
    const resolved = resolveOutputFormat(['list'], { isTTY: false })
    expect(resolved.format).toBe('json')
    expect(resolved.args).toEqual(['list'])
  })

  it('honors --json flag and removes it from args', () => {
    const resolved = resolveOutputFormat(['--json', 'organizer.nodes.search', '--query', 'active'], { isTTY: true })
    expect(resolved.format).toBe('json')
    expect(resolved.args).toEqual(['organizer.nodes.search', '--query', 'active'])
  })

  it('does not consume capability --text argument when command is already selected', () => {
    const resolved = resolveOutputFormat(
      ['comment.add', '--uuid', 'abc-123', '--text', 'progress note'],
      { isTTY: true },
    )
    expect(resolved.format).toBe('text')
    expect(resolved.args).toEqual(['comment.add', '--uuid', 'abc-123', '--text', 'progress note'])
  })
})
