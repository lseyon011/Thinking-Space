import {
  CAPABILITY_REGISTRY,
  getCapabilityDefinition,
  type CapabilityActor,
  type CapabilityInputMap,
  type CapabilityName,
  type CapabilityOutputMap,
} from '../lego_blocks/capabilityRegistryBlock'
import {
  createCapabilityInputHash,
  writeCapabilityAuditEntry,
} from '../lego_blocks/capabilityAuditLogBlock'
import { validateCapabilityPolicy } from '../lego_blocks/capabilityPolicyBlock'
import {
  createYamlNode,
  deleteYamlNode,
  getYamlNode,
  getYamlNodeByKey,
  listAllYamlNodes,
  listYamlChildren,
  listYamlRootNodes,
  moveYamlNode,
  readYamlFrontmatterByPath,
  renameYamlNode,
  searchYamlNodes,
  updateYamlNode,
} from '../lego_blocks/yamlHierarchyBlock'
import { getVaultFS, type VaultFS } from '../lego_blocks/fsBlock'
import { createThought } from './thoughtsOrch'
import { createTodos, toggleTodo } from './todosOrch'
import { listFiles, listFolders, listPdfFiles } from './fileSystemOrch'
import { formatAndSave, previewFormat } from './formatExcalidrawOrch'
import { convertPdf, previewPdf } from './pdfToMarkdownOrch'
import { cleanAndSave, previewTranscript } from './transcriptCleanerOrch'
import { getCapabilityFeatureFlags } from '../lego_blocks/capabilityFeatureFlagsBlock'

export interface CapabilityInvokeRequest<Name extends CapabilityName = CapabilityName> {
  capability: Name
  input: CapabilityInputMap[Name]
  actor?: CapabilityActor
  requestId?: string
  dryRun?: boolean
}

export interface CapabilityInvokeSuccess<Name extends CapabilityName> {
  ok: true
  capability: Name
  requestId: string
  actor: CapabilityActor
  dryRun: boolean
  auditId: string
  warnings: string[]
  data: CapabilityOutputMap[Name]
}

export interface CapabilityInvokeFailure<Name extends CapabilityName> {
  ok: false
  capability: Name
  requestId: string
  actor: CapabilityActor
  dryRun: boolean
  auditId: string
  warnings: string[]
  error: {
    code: 'CAPABILITY_VALIDATION_FAILED' | 'CAPABILITY_NOT_FOUND' | 'CAPABILITY_EXECUTION_FAILED' | 'CAPABILITY_DRY_RUN_UNSUPPORTED'
    message: string
  }
}

export type CapabilityInvokeResponse<Name extends CapabilityName> =
  | CapabilityInvokeSuccess<Name>
  | CapabilityInvokeFailure<Name>

const DEFAULT_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.unknown',
}

const WRITE_CAPABILITIES = new Set<CapabilityName>([
  'organizer.node.create',
  'organizer.node.rename',
  'organizer.node.update',
  'organizer.node.move',
  'organizer.node.delete',
  'thoughts.create',
  'todos.create',
  'todos.toggle',
  'tools.excalidraw.format',
  'tools.pdf.convert',
  'tools.transcript.clean_save',
])

export function listCapabilitiesOrch() {
  return CAPABILITY_REGISTRY
}

export async function invokeCapabilityOrch<Name extends CapabilityName>(
  request: CapabilityInvokeRequest<Name>,
  options?: { fs?: VaultFS },
): Promise<CapabilityInvokeResponse<Name>> {
  const requestId = request.requestId || createRequestId()
  const auditId = createAuditId()
  const actor = request.actor ?? DEFAULT_ACTOR
  const dryRun = !!request.dryRun
  const warnings: string[] = []
  const fs = options?.fs

  const definition = getCapabilityDefinition(request.capability)
  if (!definition) {
    const response: CapabilityInvokeFailure<Name> = {
      ok: false,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      auditId,
      warnings,
      error: {
        code: 'CAPABILITY_NOT_FOUND',
        message: `Unknown capability: ${request.capability}`,
      },
    }
    await auditCapability({
      auditId,
      requestId,
      request,
      actor,
      dryRun,
      warnings,
      ok: false,
      errorCode: response.error.code,
      errorMessage: response.error.message,
      fs,
    })
    return response
  }

  try {
    if (actor.kind === 'agent' && !getCapabilityFeatureFlags().agent_capabilities_enabled) {
      throw new Error('Agent capabilities are disabled by feature flag.')
    }

    validateCapabilityPolicy({
      capability: request.capability,
      input: request.input,
      actor,
    })

    if (dryRun && WRITE_CAPABILITIES.has(request.capability)) {
      const preview = await executeDryRunCapability(request.capability, request.input)
      if (preview) {
        warnings.push('Dry-run preview only. No files were modified.')
        const success: CapabilityInvokeSuccess<Name> = {
          ok: true,
          capability: request.capability,
          requestId,
          actor,
          dryRun,
          auditId,
          warnings,
          data: preview as CapabilityOutputMap[Name],
        }
        await auditCapability({
          auditId,
          requestId,
          request,
          actor,
          dryRun,
          warnings,
          ok: true,
          touchedPaths: extractTouchedPaths(request.capability, success.data),
          fs,
        })
        return success
      }

      const unsupported: CapabilityInvokeFailure<Name> = {
        ok: false,
        capability: request.capability,
        requestId,
        actor,
        dryRun,
        auditId,
        warnings,
        error: {
          code: 'CAPABILITY_DRY_RUN_UNSUPPORTED',
          message: `Dry-run is not implemented for ${request.capability}.`,
        },
      }
      await auditCapability({
        auditId,
        requestId,
        request,
        actor,
        dryRun,
        warnings,
        ok: false,
        errorCode: unsupported.error.code,
        errorMessage: unsupported.error.message,
        fs,
      })
      return unsupported
    }

    const data = await executeCapability(request.capability, request.input, fs)
    const success: CapabilityInvokeSuccess<Name> = {
      ok: true,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      auditId,
      warnings,
      data,
    }
    await auditCapability({
      auditId,
      requestId,
      request,
      actor,
      dryRun,
      warnings,
      ok: true,
      touchedPaths: extractTouchedPaths(request.capability, data),
      fs,
    })
    return success
  } catch (error) {
    const failure: CapabilityInvokeFailure<Name> = {
      ok: false,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      auditId,
      warnings,
      error: {
        code: 'CAPABILITY_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    }
    await auditCapability({
      auditId,
      requestId,
      request,
      actor,
      dryRun,
      warnings,
      ok: false,
      errorCode: failure.error.code,
      errorMessage: failure.error.message,
      fs,
    })
    return failure
  }
}

export async function invokeCapabilityOrThrow<Name extends CapabilityName>(
  request: CapabilityInvokeRequest<Name>,
  options?: { fs?: VaultFS },
): Promise<CapabilityOutputMap[Name]> {
  const response = await invokeCapabilityOrch(request, options)
  if (!response.ok) {
    throw new Error(response.error.message)
  }
  return response.data
}

async function executeCapability<Name extends CapabilityName>(
  capability: Name,
  input: CapabilityInputMap[Name],
  fs?: VaultFS,
): Promise<CapabilityOutputMap[Name]> {
  switch (capability) {
    case 'organizer.nodes.list_roots': {
      const payload = input as CapabilityInputMap['organizer.nodes.list_roots']
      const nodes = await listYamlRootNodes(payload.typeFilter)
      return { nodes } as CapabilityOutputMap[Name]
    }
    case 'organizer.nodes.list_children': {
      const payload = input as CapabilityInputMap['organizer.nodes.list_children']
      assertNonEmptyString(payload.parentKey, 'parentKey')
      const nodes = await listYamlChildren(payload.parentKey)
      return { nodes } as CapabilityOutputMap[Name]
    }
    case 'organizer.nodes.list_all': {
      const nodes = await listAllYamlNodes()
      return { nodes } as CapabilityOutputMap[Name]
    }
    case 'organizer.nodes.search': {
      const payload = input as CapabilityInputMap['organizer.nodes.search']
      assertNonEmptyString(payload.query, 'query')
      const nodes = await searchYamlNodes(payload.query, payload.limit)
      return { nodes } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.get': {
      const payload = input as CapabilityInputMap['organizer.node.get']
      assertNonEmptyString(payload.uuid, 'uuid')
      const node = await getYamlNode(payload.uuid)
      return { node: node ?? null } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.get_by_key': {
      const payload = input as CapabilityInputMap['organizer.node.get_by_key']
      assertNonEmptyString(payload.key, 'key')
      const node = await getYamlNodeByKey(payload.key)
      return { node: node ?? null } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.read_frontmatter': {
      const payload = input as CapabilityInputMap['organizer.node.read_frontmatter']
      assertNonEmptyString(payload.filePath, 'filePath')
      const frontmatter = await readYamlFrontmatterByPath(payload.filePath, fs)
      return { frontmatter } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.create': {
      const payload = input as CapabilityInputMap['organizer.node.create']
      assertNonEmptyString(payload.title, 'title')
      const node = await createYamlNode({ ...payload, fs })
      return { node } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.rename': {
      const payload = input as CapabilityInputMap['organizer.node.rename']
      assertNonEmptyString(payload.uuid, 'uuid')
      assertNonEmptyString(payload.newTitle, 'newTitle')
      const node = await renameYamlNode(payload.uuid, payload.newTitle, fs)
      return { node } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.update': {
      const payload = input as CapabilityInputMap['organizer.node.update']
      assertNonEmptyString(payload.uuid, 'uuid')
      const node = await updateYamlNode(payload.uuid, payload.updates, fs)
      return { node } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.move': {
      const payload = input as CapabilityInputMap['organizer.node.move']
      assertNonEmptyString(payload.uuid, 'uuid')
      const node = await moveYamlNode(payload.uuid, payload.newParentKey, fs)
      return { node } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.delete': {
      const payload = input as CapabilityInputMap['organizer.node.delete']
      assertNonEmptyString(payload.uuid, 'uuid')
      const existing = await getYamlNode(payload.uuid)
      const childCount = existing ? (await listYamlChildren(existing.key)).length : 0
      await deleteYamlNode(payload.uuid, fs)
      return {
        deleted: true,
        preview: existing
          ? {
            nodeUuid: existing.uuid,
            filePath: existing.filePath,
            parentKey: existing.parent ?? null,
            childCount,
            touchedPaths: [existing.filePath],
          }
          : undefined,
      } as CapabilityOutputMap[Name]
    }
    case 'thoughts.create': {
      const payload = input as CapabilityInputMap['thoughts.create']
      assertNonEmptyString(payload.folder_path, 'folder_path')
      assertNonEmptyString(payload.filename, 'filename')
      assertNonEmptyString(payload.content, 'content')
      const output = await createThought(payload)
      return output as CapabilityOutputMap[Name]
    }
    case 'todos.create': {
      const payload = input as CapabilityInputMap['todos.create']
      assertNonEmptyString(payload.folderPath, 'folderPath')
      assertNonEmptyString(payload.date, 'date')
      const output = await createTodos(payload.folderPath, payload.date, payload.items)
      return output as CapabilityOutputMap[Name]
    }
    case 'todos.toggle': {
      const payload = input as CapabilityInputMap['todos.toggle']
      assertNonEmptyString(payload.filePath, 'filePath')
      if (!Number.isInteger(payload.lineNumber) || payload.lineNumber <= 0) {
        throw new Error('lineNumber must be a positive integer')
      }
      await toggleTodo(payload.filePath, payload.lineNumber)
      return {
        toggled: true,
        filePath: payload.filePath,
      } as CapabilityOutputMap[Name]
    }
    case 'tools.files.list_markdown': {
      const payload = input as CapabilityInputMap['tools.files.list_markdown']
      const files = await listFiles(payload.limit)
      return { files } as CapabilityOutputMap[Name]
    }
    case 'tools.files.list_pdf': {
      const payload = input as CapabilityInputMap['tools.files.list_pdf']
      const files = await listPdfFiles(payload.limit)
      return { files } as CapabilityOutputMap[Name]
    }
    case 'tools.folders.list': {
      const payload = input as CapabilityInputMap['tools.folders.list']
      const folders = await listFolders(payload.limit)
      return { folders } as CapabilityOutputMap[Name]
    }
    case 'tools.excalidraw.preview': {
      const payload = input as CapabilityInputMap['tools.excalidraw.preview']
      assertNonEmptyString(payload.inputPath, 'inputPath')
      const preview = await previewFormat(payload.inputPath, payload.options)
      return { preview } as CapabilityOutputMap[Name]
    }
    case 'tools.excalidraw.format': {
      const payload = input as CapabilityInputMap['tools.excalidraw.format']
      assertNonEmptyString(payload.inputPath, 'inputPath')
      const result = await formatAndSave(payload.inputPath, payload.options)
      return { result } as CapabilityOutputMap[Name]
    }
    case 'tools.pdf.preview': {
      const payload = input as CapabilityInputMap['tools.pdf.preview']
      assertNonEmptyString(payload.inputPath, 'inputPath')
      const preview = await previewPdf(payload.inputPath, payload.options)
      return { preview } as CapabilityOutputMap[Name]
    }
    case 'tools.pdf.convert': {
      const payload = input as CapabilityInputMap['tools.pdf.convert']
      assertNonEmptyString(payload.inputPath, 'inputPath')
      const result = await convertPdf(payload.inputPath, payload.options)
      return { result } as CapabilityOutputMap[Name]
    }
    case 'tools.transcript.preview': {
      const payload = input as CapabilityInputMap['tools.transcript.preview']
      assertNonEmptyString(payload.inputText, 'inputText')
      const result = previewTranscript(payload.inputText, payload.headingsText, payload.options)
      return { result } as CapabilityOutputMap[Name]
    }
    case 'tools.transcript.clean_save': {
      const payload = input as CapabilityInputMap['tools.transcript.clean_save']
      assertNonEmptyString(payload.input_text, 'input_text')
      assertNonEmptyString(payload.output_folder, 'output_folder')
      assertNonEmptyString(payload.output_name, 'output_name')
      const result = await cleanAndSave(payload)
      return { result } as CapabilityOutputMap[Name]
    }
    default:
      throw new Error(`Capability not implemented: ${String(capability)}`)
  }
}

async function executeDryRunCapability<Name extends CapabilityName>(
  capability: Name,
  input: CapabilityInputMap[Name],
): Promise<CapabilityOutputMap[Name] | null> {
  switch (capability) {
    case 'organizer.node.move': {
      const payload = input as CapabilityInputMap['organizer.node.move']
      assertNonEmptyString(payload.uuid, 'uuid')
      const source = await getYamlNode(payload.uuid)
      if (!source) throw new Error(`Node not found: ${payload.uuid}`)

      const fromParentKey = source.parent ?? null
      let toParentKey: string | null = payload.newParentKey
      let toParentUuid = source.parentUuid
      let toParentType = source.parentType
      if (payload.newParentKey) {
        const parent = await getYamlNodeByKey(payload.newParentKey)
        if (!parent) throw new Error(`Parent not found: ${payload.newParentKey}`)
        toParentKey = parent.key
        toParentUuid = parent.uuid
        toParentType = parent.type
      } else {
        toParentKey = null
        toParentUuid = undefined
        toParentType = undefined
      }

      const previewNode = {
        ...source,
        parent: toParentKey ?? undefined,
        parentUuid: toParentUuid,
        parentType: toParentType,
        updatedAt: new Date().toISOString(),
      }

      return {
        node: previewNode,
        preview: {
          nodeUuid: source.uuid,
          fromParentKey,
          toParentKey,
          touchedPaths: [source.filePath],
        },
      } as unknown as CapabilityOutputMap[Name]
    }

    case 'organizer.node.delete': {
      const payload = input as CapabilityInputMap['organizer.node.delete']
      assertNonEmptyString(payload.uuid, 'uuid')
      const target = await getYamlNode(payload.uuid)
      if (!target) {
        return {
          deleted: true,
          preview: {
            nodeUuid: payload.uuid,
            parentKey: null,
            childCount: 0,
            touchedPaths: [],
          },
        } as unknown as CapabilityOutputMap[Name]
      }

      const childCount = (await listYamlChildren(target.key)).length
      return {
        deleted: true,
        preview: {
          nodeUuid: target.uuid,
          filePath: target.filePath,
          parentKey: target.parent ?? null,
          childCount,
          touchedPaths: [target.filePath],
        },
      } as unknown as CapabilityOutputMap[Name]
    }
    default:
      return null
  }
}

function assertNonEmptyString(value: string | undefined, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`Missing required field: ${field}`)
  }
}

function createRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `cap-${Date.now().toString(36)}-${rand}`
}

function createAuditId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `audit-${Date.now().toString(36)}-${rand}`
}

function extractTouchedPaths<Name extends CapabilityName>(
  capability: Name,
  data: CapabilityOutputMap[Name],
): string[] {
  switch (capability) {
    case 'organizer.node.create':
    case 'organizer.node.rename':
    case 'organizer.node.update':
    case 'organizer.node.move': {
      const node = (data as
        | CapabilityOutputMap['organizer.node.create']
        | CapabilityOutputMap['organizer.node.rename']
        | CapabilityOutputMap['organizer.node.update']
        | CapabilityOutputMap['organizer.node.move']).node
      return node?.filePath ? [node.filePath] : []
    }
    case 'organizer.node.delete': {
      const preview = (data as CapabilityOutputMap['organizer.node.delete']).preview
      return preview?.touchedPaths ?? []
    }
    case 'thoughts.create': {
      const output = data as CapabilityOutputMap['thoughts.create']
      return output.output_path ? [output.output_path] : []
    }
    case 'todos.create': {
      const output = data as CapabilityOutputMap['todos.create']
      return output.output_path ? [output.output_path] : []
    }
    case 'todos.toggle': {
      const output = data as CapabilityOutputMap['todos.toggle']
      return output.filePath ? [output.filePath] : []
    }
    case 'tools.excalidraw.format': {
      const output = data as CapabilityOutputMap['tools.excalidraw.format']
      return output.result.output_path ? [output.result.output_path] : []
    }
    case 'tools.pdf.convert': {
      const output = data as CapabilityOutputMap['tools.pdf.convert']
      return output.result.output_path ? [output.result.output_path] : []
    }
    case 'tools.transcript.clean_save': {
      const output = data as CapabilityOutputMap['tools.transcript.clean_save']
      return output.result.output_path ? [output.result.output_path] : []
    }
    default:
      return []
  }
}

async function auditCapability<Name extends CapabilityName>(params: {
  auditId: string
  requestId: string
  request: CapabilityInvokeRequest<Name>
  actor: CapabilityActor
  dryRun: boolean
  warnings: string[]
  ok: boolean
  touchedPaths?: string[]
  errorCode?: string
  errorMessage?: string
  fs?: VaultFS
}): Promise<void> {
  try {
    const fs = params.fs ?? getVaultFS()
    await writeCapabilityAuditEntry({
      auditId: params.auditId,
      timestamp: new Date().toISOString(),
      requestId: params.requestId,
      capability: params.request.capability,
      actorKind: params.actor.kind,
      actorId: params.actor.id,
      dryRun: params.dryRun,
      ok: params.ok,
      inputHash: createCapabilityInputHash(params.request.input),
      touchedPaths: params.touchedPaths ?? [],
      warnings: params.warnings,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
    }, fs)
  } catch {
    // Audit logging must never break the primary capability flow.
  }
}
