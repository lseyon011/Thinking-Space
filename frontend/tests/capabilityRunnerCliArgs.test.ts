import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildCLIInvokePayload } from '../scripts/agent/capabilityRunner'

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
})
