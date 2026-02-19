import { getVaultFS, type VaultFS } from '../lego_blocks/fsBlock'
import { parseExtensionManifestBlock } from '../lego_blocks/extensionManifestBlock'
import { parseExtensionActionsBlock, type ExtensionDeclarativeAction } from '../lego_blocks/extensionActionBlock'
import { getRequiredPermissionsForCapabilityBlock } from '../lego_blocks/extensionPermissionBlock'
import { getCapabilityFeatureFlags } from '../lego_blocks/capabilityFeatureFlagsBlock'
import {
  buildExtensionBuilderPromptBlock,
  buildFallbackExtensionBuilderDraftBlock,
  parseExtensionBuilderDraftFromAiBlock,
  type ExtensionBuilderDraft,
} from '../lego_blocks/extensionPromptTemplateBlock'
import { resolveAiSelectionOrch } from './aiSettingsOrch'
import { sendChatWithTelemetryOrch, type AiTelemetryEvent } from './chatOrch'
import {
  activateExtensionOrch,
  reloadExtensionOrch,
  type ExtensionDiscoverInput,
} from './extensionLoaderOrch'

export type ExtensionBuilderGenerationMode = 'ai' | 'template'

export interface GeneratedExtensionFile {
  path: string
  content: string
  language: 'json' | 'markdown'
}

export interface ExtensionFilePreviewEntry {
  path: string
  status: 'added' | 'modified' | 'unchanged'
}

export interface GeneratedExtensionArtifactSet {
  featureId: string
  extensionPath: string
  generationMode: ExtensionBuilderGenerationMode
  intent: string
  draft: ExtensionBuilderDraft
  files: GeneratedExtensionFile[]
  permissionSet: string[]
  preview: ExtensionFilePreviewEntry[]
  telemetry?: AiTelemetryEvent
}

export interface GenerateExtensionArtifactsInput {
  intent: string
  forceTemplate?: boolean
  fs?: VaultFS
}

export interface SaveGeneratedExtensionArtifactsInput {
  artifactSet: GeneratedExtensionArtifactSet
  approvePermissions: boolean
  activateAfterSave: boolean
  fs?: VaultFS
  appVersion?: string
  supportedApiVersions?: string[]
}

export interface SaveGeneratedExtensionArtifactsResult {
  savedPaths: string[]
  activated: boolean
  extensionPath: string
  featureId: string
}

const DEFAULT_EXTENSION_BUILDER_APP_VERSION = '0.1.0'
const DEFAULT_API_VERSIONS = ['1']

export async function generateExtensionArtifactsOrch(
  input: GenerateExtensionArtifactsInput,
): Promise<GeneratedExtensionArtifactSet> {
  assertExtensionBuilderEnabled()
  const intent = input.intent.trim()
  if (!intent) throw new Error('Feature intent is required.')

  const fs = input.fs ?? safeGetVaultFs()
  const generated = input.forceTemplate
    ? {
      mode: 'template' as const,
      draft: buildFallbackExtensionBuilderDraftBlock(intent),
      telemetry: undefined,
    }
    : await generateDraftWithAiOrFallback(intent)

  const draft = normalizeDraft(generated.draft)
  const extensionPath = `.extensions/${draft.featureId}`
  const files = buildGeneratedFiles(draft)
  const preview = await buildPreview(fs, extensionPath, files)

  return {
    featureId: draft.featureId,
    extensionPath,
    generationMode: generated.mode,
    intent,
    draft,
    files,
    permissionSet: [...draft.permissions],
    preview,
    ...(generated.telemetry ? { telemetry: generated.telemetry } : {}),
  }
}

export async function saveGeneratedExtensionArtifactsOrch(
  input: SaveGeneratedExtensionArtifactsInput,
): Promise<SaveGeneratedExtensionArtifactsResult> {
  assertExtensionBuilderEnabled()
  if (!input.approvePermissions) {
    throw new Error('Permission review must be approved before saving generated extension.')
  }

  const fs = input.fs ?? getVaultFS()
  const { draft } = input.artifactSet
  const extensionPath = `.extensions/${draft.featureId}`
  const files = buildGeneratedFiles(draft)
  validateGeneratedArtifacts(draft, files)

  await fs.mkdir(extensionPath)
  const savedPaths: string[] = []
  for (const file of files) {
    const fullPath = joinPath(extensionPath, file.path)
    await ensureParentDir(fs, fullPath)
    await fs.write(fullPath, file.content)
    savedPaths.push(fullPath)
  }

  const discoveryInput: ExtensionDiscoverInput = {
    fs,
    appVersion: input.appVersion ?? DEFAULT_EXTENSION_BUILDER_APP_VERSION,
    supportedApiVersions: input.supportedApiVersions ?? DEFAULT_API_VERSIONS,
  }
  const reloaded = await reloadExtensionOrch({
    ...discoveryInput,
    registryKey: draft.featureId,
  })

  let activated = false
  if (input.activateAfterSave) {
    if (!reloaded.loadable) {
      throw new Error(reloaded.reason?.message ?? 'Generated extension failed compatibility checks.')
    }
    activateExtensionOrch(draft.featureId)
    activated = true
  }

  return {
    savedPaths,
    activated,
    extensionPath,
    featureId: draft.featureId,
  }
}

async function generateDraftWithAiOrFallback(intent: string): Promise<{
  mode: ExtensionBuilderGenerationMode
  draft: ExtensionBuilderDraft
  telemetry?: AiTelemetryEvent
}> {
  try {
    const selection = await resolveAiSelectionOrch({ scope: 'chat' })
    if (!selection) {
      return {
        mode: 'template',
        draft: buildFallbackExtensionBuilderDraftBlock(intent),
      }
    }

    const prompts = buildExtensionBuilderPromptBlock(intent)
    const { response, telemetryEvent } = await sendChatWithTelemetryOrch(
      selection.provider,
      [
        { role: 'assistant', content: prompts.systemPrompt },
        { role: 'user', content: prompts.userPrompt },
      ],
      { model: selection.model },
      {
        useCase: 'extensions.builder.generate',
        metadata: {
          provider: selection.provider,
          scope: selection.scope ?? 'chat',
        },
      },
    )
    const parsed = parseExtensionBuilderDraftFromAiBlock(response.content)
    if (!parsed) {
      return {
        mode: 'template',
        draft: buildFallbackExtensionBuilderDraftBlock(intent),
        telemetry: telemetryEvent,
      }
    }
    return {
      mode: 'ai',
      draft: parsed,
      telemetry: telemetryEvent,
    }
  } catch {
    return {
      mode: 'template',
      draft: buildFallbackExtensionBuilderDraftBlock(intent),
    }
  }
}

function normalizeDraft(draft: ExtensionBuilderDraft): ExtensionBuilderDraft {
  const featureId = normalizeFeatureId(draft.featureId)
  const description = draft.description.trim() || 'Generated by extension builder.'
  const name = draft.name.trim() || 'Generated Extension'
  const permissions = dedupeStrings([
    ...draft.permissions.map(value => value.trim()).filter(Boolean),
    ...derivePermissionsFromActions(draft.actions),
  ])

  const actionsResult = parseExtensionActionsBlock(draft.actions)
  const actions = actionsResult.ok ? actionsResult.actions : buildFallbackExtensionBuilderDraftBlock(name).actions

  return {
    ...draft,
    featureId,
    name,
    description,
    permissions,
    actions,
    promptMarkdown: draft.promptMarkdown.trim(),
  }
}

function buildGeneratedFiles(draft: ExtensionBuilderDraft): GeneratedExtensionFile[] {
  const targets = dedupeStrings(draft.actions.map(action => action.target))
  const manifest = {
    id: `com.thinking-space.${draft.featureId}`,
    name: draft.name,
    version: '1.0.0',
    api_version: '1',
    entry_kind: 'declarative',
    min_app_version: DEFAULT_EXTENSION_BUILDER_APP_VERSION,
    permissions: draft.permissions,
    targets: targets.length > 0 ? targets : ['sidebar-bottom'],
    description: draft.description,
    actions: draft.actions,
  }

  return [
    {
      path: 'manifest.json',
      language: 'json',
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      path: 'actions.json',
      language: 'json',
      content: `${JSON.stringify(draft.actions, null, 2)}\n`,
    },
    {
      path: 'prompts/feature.md',
      language: 'markdown',
      content: `${draft.promptMarkdown}\n`,
    },
    {
      path: 'ui/schema.json',
      language: 'json',
      content: `${JSON.stringify(draft.uiSchema, null, 2)}\n`,
    },
  ]
}

async function buildPreview(
  fs: VaultFS | null,
  extensionPath: string,
  files: GeneratedExtensionFile[],
): Promise<ExtensionFilePreviewEntry[]> {
  const entries: ExtensionFilePreviewEntry[] = []
  for (const file of files) {
    const fullPath = joinPath(extensionPath, file.path)
    if (!fs) {
      entries.push({ path: file.path, status: 'added' })
      continue
    }
    const exists = await safeExists(fs, fullPath)
    if (!exists) {
      entries.push({ path: file.path, status: 'added' })
      continue
    }
    const current = await fs.read(fullPath)
    entries.push({
      path: file.path,
      status: current === file.content ? 'unchanged' : 'modified',
    })
  }
  return entries
}

function validateGeneratedArtifacts(draft: ExtensionBuilderDraft, files: GeneratedExtensionFile[]): void {
  const manifestFile = files.find(file => file.path === 'manifest.json')
  if (!manifestFile) throw new Error('Generated artifacts missing manifest.json')
  let manifestRaw: unknown
  try {
    manifestRaw = JSON.parse(manifestFile.content)
  } catch {
    throw new Error('Generated manifest.json is not valid JSON')
  }
  const manifestValidation = parseExtensionManifestBlock(manifestRaw)
  if (!manifestValidation.ok) {
    throw new Error(`Manifest validation failed: ${manifestValidation.error.field} ${manifestValidation.error.message}`)
  }

  const actionsValidation = parseExtensionActionsBlock(draft.actions)
  if (!actionsValidation.ok) {
    throw new Error(`Action validation failed: ${actionsValidation.error.field} ${actionsValidation.error.message}`)
  }
}

function derivePermissionsFromActions(actions: ExtensionDeclarativeAction[]): string[] {
  const permissions: string[] = []
  for (const action of actions) {
    if (!action.capability) continue
    for (const permission of getRequiredPermissionsForCapabilityBlock(action.capability)) {
      if (!permissions.includes(permission)) permissions.push(permission)
    }
  }
  return permissions
}

async function ensureParentDir(fs: VaultFS, path: string): Promise<void> {
  const idx = path.lastIndexOf('/')
  if (idx <= 0) return
  const parent = path.slice(0, idx)
  await fs.mkdir(parent)
}

function normalizeFeatureId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return normalized || 'generated-feature'
}

function dedupeStrings(values: string[]): string[] {
  const next: string[] = []
  for (const value of values) {
    if (!next.includes(value)) next.push(value)
  }
  return next
}

function joinPath(...parts: string[]): string {
  return parts
    .map(part => part.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
}

async function safeExists(fs: VaultFS, path: string): Promise<boolean> {
  try {
    return await fs.exists(path)
  } catch {
    return false
  }
}

function safeGetVaultFs(): VaultFS | null {
  try {
    return getVaultFS()
  } catch {
    return null
  }
}

function assertExtensionBuilderEnabled(): void {
  const flags = getCapabilityFeatureFlags()
  if (!flags.extension_builder_enabled) {
    throw new Error('Extension builder is disabled by feature flag.')
  }
  if (!flags.extension_host_enabled) {
    throw new Error('Extension host is disabled by feature flag.')
  }
}
