import {
  getExtensionManifestCompatibilityBlock,
  parseExtensionManifestBlock,
  type ExtensionManifest,
  type ExtensionManifestCompatibilityResult,
  type ExtensionManifestRuntimeTarget,
  type ExtensionManifestValidationResult,
} from '@/services/lego_blocks/units/extensionManifestBlock'

export const SUPPORTED_EXTENSION_API_VERSIONS_ORCH = ['1']

export interface ExtensionHostCompatibilityInput {
  appVersion: string
  supportedApiVersions?: string[]
  runtimeTarget?: ExtensionManifestRuntimeTarget
}

export function validateExtensionManifestOrch(raw: unknown): ExtensionManifestValidationResult {
  return parseExtensionManifestBlock(raw)
}

export function resolveExtensionManifestCompatibilityOrch(
  manifest: ExtensionManifest,
  input: ExtensionHostCompatibilityInput,
): ExtensionManifestCompatibilityResult {
  return getExtensionManifestCompatibilityBlock(manifest, {
    appVersion: input.appVersion,
    supportedApiVersions: input.supportedApiVersions ?? SUPPORTED_EXTENSION_API_VERSIONS_ORCH,
    runtimeTarget: input.runtimeTarget,
  })
}
