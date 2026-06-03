import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from '@/services/lego_blocks/units/storageKeyBlock'

export interface CapabilityFeatureFlags {
  agent_capabilities_enabled: boolean
  fastapi_capability_adapter_enabled: boolean
  extension_host_enabled: boolean
  extension_builder_enabled: boolean
  yaml_fields_auto_heal_enabled: boolean
  hybrid_sync_reconciliation_enabled: boolean
}

const DEFAULT_FLAGS: CapabilityFeatureFlags = {
  agent_capabilities_enabled: false,
  fastapi_capability_adapter_enabled: false,
  extension_host_enabled: false,
  extension_builder_enabled: false,
  yaml_fields_auto_heal_enabled: false,
  hybrid_sync_reconciliation_enabled: false,
}

export function getCapabilityFeatureFlags(): CapabilityFeatureFlags {
  const stored = getJsonStorageItem<Record<string, unknown>>(
    STORAGE_KEYS.capabilityFeatureFlags,
    DEFAULT_FLAGS as unknown as Record<string, unknown>,
  )

  return {
    ...DEFAULT_FLAGS,
    ...stored,
    yaml_fields_auto_heal_enabled: Boolean(
      stored.yaml_fields_auto_heal_enabled
      ?? stored.wiki_links_auto_heal_enabled
      ?? DEFAULT_FLAGS.yaml_fields_auto_heal_enabled
    ),
    hybrid_sync_reconciliation_enabled: Boolean(
      stored.hybrid_sync_reconciliation_enabled
      ?? DEFAULT_FLAGS.hybrid_sync_reconciliation_enabled
    ),
  }
}

export function setCapabilityFeatureFlags(flags: CapabilityFeatureFlags): void {
  setJsonStorageItem(STORAGE_KEYS.capabilityFeatureFlags, flags)
}

export function setCapabilityFeatureFlag<K extends keyof CapabilityFeatureFlags>(
  key: K,
  value: CapabilityFeatureFlags[K],
): CapabilityFeatureFlags {
  const next = { ...getCapabilityFeatureFlags(), [key]: value }
  setCapabilityFeatureFlags(next)
  return next
}
