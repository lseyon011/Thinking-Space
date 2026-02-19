import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from './storageKeyBlock'

export interface CapabilityFeatureFlags {
  agent_capabilities_enabled: boolean
  fastapi_capability_adapter_enabled: boolean
  extension_host_enabled: boolean
  extension_builder_enabled: boolean
}

const DEFAULT_FLAGS: CapabilityFeatureFlags = {
  agent_capabilities_enabled: false,
  fastapi_capability_adapter_enabled: false,
  extension_host_enabled: false,
  extension_builder_enabled: false,
}

export function getCapabilityFeatureFlags(): CapabilityFeatureFlags {
  return getJsonStorageItem<CapabilityFeatureFlags>(
    STORAGE_KEYS.capabilityFeatureFlags,
    DEFAULT_FLAGS,
  )
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
