import { describe, expect, it } from 'vitest'
import {
  resolveExtensionManifestCompatibilityOrch,
  SUPPORTED_EXTENSION_API_VERSIONS_ORCH,
  validateExtensionManifestOrch,
} from '@/services/orchestrators/extensionHostOrch'

describe('extensionHostOrch', () => {
  it('exposes supported API versions for host runtime', () => {
    expect(SUPPORTED_EXTENSION_API_VERSIONS_ORCH).toEqual(['1'])
  })

  it('validates and evaluates compatibility with default supported API versions', () => {
    const parsed = validateExtensionManifestOrch({
      id: 'com.thinking-space.host-smoke',
      name: 'Host smoke',
      version: '1.0.0',
      api_version: '1',
      entry_kind: 'declarative',
      min_app_version: '0.4.0',
      permissions: ['read:thoughts'],
      targets: ['toolbar'],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const compatibility = resolveExtensionManifestCompatibilityOrch(parsed.manifest, {
      appVersion: '0.4.1',
    })
    expect(compatibility).toEqual({
      loadable: true,
      reason: null,
    })
  })
})
