import { describe, expect, it } from 'vitest'
import {
  checkExtensionCapabilityPermissionBlock,
  getRequiredPermissionsForCapabilityBlock,
  normalizeExtensionPermissionsBlock,
} from '@/services/lego_blocks/extensionPermissionBlock'

describe('extensionPermissionBlock', () => {
  it('normalizes extension permission scopes deterministically', () => {
    expect(normalizeExtensionPermissionsBlock([' organizer:read ', 'organizer:read', 'tools:pdf'])).toEqual([
      'organizer:read',
      'tools:pdf',
    ])
  })

  it('allows mapped capability when at least one required permission is declared', () => {
    const decision = checkExtensionCapabilityPermissionBlock({
      permissions: ['organizer:read'],
      capability: 'organizer.node.get',
    })
    expect(decision).toMatchObject({
      allowed: true,
      reasonCode: null,
      requiredPermissions: ['organizer:read'],
    })
  })

  it('denies capability when required permission is missing', () => {
    const decision = checkExtensionCapabilityPermissionBlock({
      permissions: ['organizer:read'],
      capability: 'organizer.node.create',
    })
    expect(decision).toMatchObject({
      allowed: false,
      reasonCode: 'MISSING_PERMISSION',
      requiredPermissions: ['organizer:write'],
    })
    expect(decision.message).toContain('requires one of')
  })

  it('returns deterministic required permission scope for mapped capabilities', () => {
    expect(getRequiredPermissionsForCapabilityBlock('tools.pdf.convert')).toEqual(['tools:pdf'])
  })
})

