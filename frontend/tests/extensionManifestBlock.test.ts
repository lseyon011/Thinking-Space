import { describe, expect, it } from 'vitest'
import {
  getExtensionManifestCompatibilityBlock,
  parseExtensionManifestBlock,
} from '@/services/lego_blocks/extensionManifestBlock'

function buildValidManifestRaw(): Record<string, unknown> {
  return {
    id: ' com.thinking-space.demo ',
    name: ' Demo Extension ',
    version: ' 1.2.3 ',
    api_version: ' 1 ',
    min_app_version: ' 0.4.0 ',
    permissions: [' read:thoughts ', 'write:thoughts', 'read:thoughts'],
    targets: [' toolbar ', 'sidebar', 'toolbar'],
  }
}

describe('extensionManifestBlock', () => {
  it('parses valid manifest with normalized values', () => {
    const result = parseExtensionManifestBlock(buildValidManifestRaw())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.manifest).toEqual({
      id: 'com.thinking-space.demo',
      name: 'Demo Extension',
      version: '1.2.3',
      api_version: '1',
      min_app_version: '0.4.0',
      permissions: ['read:thoughts', 'write:thoughts'],
      targets: ['toolbar', 'sidebar'],
    })
  })

  it('returns deterministic error for missing required field', () => {
    const raw = buildValidManifestRaw()
    delete raw.id
    const result = parseExtensionManifestBlock(raw)
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'FIELD_REQUIRED',
        field: 'id',
        message: 'id is required.',
      },
    })
  })

  it('returns deterministic error for invalid semver', () => {
    const raw = buildValidManifestRaw()
    raw.min_app_version = 'latest'
    const result = parseExtensionManifestBlock(raw)
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'FIELD_SEMVER_INVALID',
        field: 'min_app_version',
        message: 'min_app_version must be a valid semver string (x.y.z).',
      },
    })
  })

  it('disables manifest when api_version is unsupported', () => {
    const parsed = parseExtensionManifestBlock(buildValidManifestRaw())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const compatibility = getExtensionManifestCompatibilityBlock(parsed.manifest, {
      appVersion: '0.9.0',
      supportedApiVersions: ['2'],
    })
    expect(compatibility).toEqual({
      loadable: false,
      reason: {
        code: 'UNSUPPORTED_API_VERSION',
        message: 'Manifest api_version "1" is not supported.',
      },
    })
  })

  it('disables manifest when runtime app version is below min_app_version', () => {
    const parsed = parseExtensionManifestBlock(buildValidManifestRaw())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const compatibility = getExtensionManifestCompatibilityBlock(parsed.manifest, {
      appVersion: '0.3.9',
      supportedApiVersions: ['1'],
    })
    expect(compatibility).toEqual({
      loadable: false,
      reason: {
        code: 'APP_VERSION_TOO_LOW',
        message: 'Manifest requires app version >= 0.4.0, current is 0.3.9.',
      },
    })
  })
})

