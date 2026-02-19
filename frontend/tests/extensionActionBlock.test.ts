import { describe, expect, it } from 'vitest'
import {
  parseExtensionActionsBlock,
  resolveExtensionActionInputBlock,
} from '@/services/lego_blocks/extensionActionBlock'

describe('extensionActionBlock', () => {
  it('parses declarative actions with normalized fields', () => {
    const result = parseExtensionActionsBlock([
      {
        id: ' open-frontmatter ',
        label: ' Read frontmatter ',
        target: 'thought-context-actions',
        capability: 'organizer.node.read_frontmatter',
        input: {
          filePath: '{{context.filePath}}',
        },
      },
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.actions).toEqual([
      {
        id: 'open-frontmatter',
        label: 'Read frontmatter',
        target: 'thought-context-actions',
        capability: 'organizer.node.read_frontmatter',
        input: {
          filePath: '{{context.filePath}}',
        },
      },
    ])
  })

  it('returns deterministic error when action target is unsupported', () => {
    const result = parseExtensionActionsBlock([
      {
        id: 'bad-target',
        label: 'Bad target',
        target: 'footer',
        capability: 'organizer.nodes.list_all',
        input: {},
      },
    ])

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ACTION_TARGET_UNSUPPORTED',
        field: 'actions[0].target',
        message: 'Unsupported action target "footer".',
      },
    })
  })

  it('resolves context placeholders in declarative action input', () => {
    const resolved = resolveExtensionActionInputBlock(
      {
        filePath: '{{context.filePath}}',
        summary: 'Node {{context.nodeKey}}',
        nested: {
          status: '{{context.status}}',
        },
      },
      {
        filePath: 'notes/sample.md',
        nodeKey: 'tp-da-t-1',
        status: 'active',
      },
    )

    expect(resolved).toEqual({
      filePath: 'notes/sample.md',
      summary: 'Node tp-da-t-1',
      nested: {
        status: 'active',
      },
    })
  })
})

