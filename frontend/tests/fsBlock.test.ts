import { describe, expect, it } from 'vitest'
import { normalizeCapacitorStoredVaultRoot } from '@/services/lego_blocks/integrations/fsBlock'

describe('fsBlock capacitor vault root normalization', () => {
  it('uses absolute picker path when stored root has cap-picker marker', () => {
    const result = normalizeCapacitorStoredVaultRoot('cap-picker:/private/var/mobile/CloudDocs/vault')
    expect(result.vaultRoot).toBe('/private/var/mobile/CloudDocs/vault')
    expect(result.normalizedStoredRoot).toBeNull()
  })

  it('migrates stale absolute roots to default relative vault root', () => {
    const result = normalizeCapacitorStoredVaultRoot('/private/var/mobile/Documents/legacy-vault')
    expect(result.vaultRoot).toBe('LTM-Vault')
    expect(result.normalizedStoredRoot).toBe('LTM-Vault')
  })

  it('falls back to default relative vault root when unset', () => {
    const result = normalizeCapacitorStoredVaultRoot(null)
    expect(result.vaultRoot).toBe('LTM-Vault')
    expect(result.normalizedStoredRoot).toBeNull()
  })
})
