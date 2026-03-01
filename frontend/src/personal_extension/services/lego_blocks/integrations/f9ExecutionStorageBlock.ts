import yaml from 'js-yaml'
import { getVaultFS, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { getStoredVaultRoot } from '@/services/lego_blocks/units/storageKeyBlock'
import { normalizeTagListBlock } from '@/services/lego_blocks/units/tagBlock'
import type { NodePriority, YAMLCommentEntry } from '@/services/lego_blocks/units/yamlNoteBlock'

const POSITION_PAYLOAD_KEYS_BLOCK = [
  'holdings',
  'positions',
  'items',
  'rows',
  'data',
  'list',
  'result',
] as const

const F9_RELATIVE_ROOT_HINTS_BLOCK = [
  'acceleration_core/',
  'coding-projects/',
  'operations/',
] as const

const DEFAULT_POSITION_BODY_BLOCK = [
  '## Notes',
  '',
  '',
  '## Comments',
  '',
].join('\n')

const DEFAULT_COMPANY_INDEX_BODY_BLOCK = [
  '## Strategy Notes',
  '',
  '',
  '## Related Ideas',
  '',
].join('\n')

export interface F9PositionSummaryBlock {
  id: string
  fileName: string
  symbol: string
  status: string
  source: string
  instrumentType: string | null
  optionType: string | null
  optionExpireDate: string | null
  optionExercisePrice: string | null
  cost: string | null
  proportion: string | null
  lastPrice: string | null
  unrealizedProfitLoss: string | null
  dayProfitLoss: string | null
  linkedIdeaId: string | null
  tags: string[]
  projectPresetTags: string[]
}

export interface F9CompanyOverviewBlock {
  companyTicker: string
  indexFilePath: string
  indexId: string
  strategyNotes: string
  relatedIdeaIds: string[]
  positions: F9PositionSummaryBlock[]
}

export interface F9ExecutionOverviewBlock {
  executionRoot: string
  companyCount: number
  positionCount: number
  companies: F9CompanyOverviewBlock[]
}

export interface F9PositionDetailBlock {
  companyTicker: string
  filePath: string
  summary: F9PositionSummaryBlock
  frontmatter: Record<string, unknown>
  body: string
}

export interface F9OverallCacheBlock {
  overallPath: string
  fetchedAt: string
  runtime: string
  selectedAccount: unknown
  accountList: unknown
  accountBalanceLegacy: unknown | null
  accountPositionsLegacy: unknown | null
  assetsPositions: unknown | null
  source: 'assets_positions' | 'legacy_positions' | 'none'
}

export interface SyncF9ExecutionInputBlock {
  executionFolderPath: string
  fetchedAt: string
  runtime: string
  selectedAccount: unknown
  accountList: unknown
  accountBalanceLegacy: unknown | null
  accountPositionsLegacy: unknown | null
  assetsPositions: unknown | null
  fs?: VaultFS
}

export interface SyncF9ExecutionResultBlock {
  executionRoot: string
  overallPath: string
  companyCount: number
  positionCount: number
  source: 'assets_positions' | 'legacy_positions' | 'none'
  warnings: string[]
}

export interface CreateF9CompanyInputBlock {
  executionFolderPath: string
  companyTicker: string
  fs?: VaultFS
}

export interface CreateF9ManualPositionInputBlock {
  executionFolderPath: string
  companyTicker: string
  title?: string
  status?: 'taken' | 'planned' | 'watchlist'
  instrumentType?: 'STOCK' | 'OPTION'
  optionType?: 'CALL' | 'PUT' | null
  optionExpireDate?: string | null
  optionExercisePrice?: string | null
  linkedIdeaId?: string | null
  notes?: string
  fs?: VaultFS
}

export interface UpdateF9PositionOverlayInputBlock {
  executionFolderPath: string
  companyTicker: string
  fileName: string
  status?: 'taken' | 'planned' | 'watchlist'
  linkedIdeaId?: string | null
  title?: string | null
  priority?: NodePriority | null
  description?: string | null
  comments?: YAMLCommentEntry[]
  tags?: string[]
  projectPresetTags?: string[]
  fs?: VaultFS
}

export interface SaveF9PositionBodyInputBlock {
  executionFolderPath: string
  companyTicker: string
  fileName: string
  body: string
  fs?: VaultFS
}

interface ParsedMarkdownFrontmatterBlock {
  frontmatter: Record<string, unknown>
  body: string
}

interface ExistingPositionRecordBlock {
  id: string
  fileName: string
  filePath: string
  frontmatter: Record<string, unknown>
  body: string
  summary: F9PositionSummaryBlock
}

export function resolveF9ExecutionRootForVaultBlock(executionFolderPath: string): string {
  const normalizedInput = normalizeSlashPathBlock(removeFileSchemeBlock(executionFolderPath).trim())
  if (!normalizedInput) {
    throw new Error('F9 execution folder path is required.')
  }

  if (!normalizedInput.startsWith('/')) {
    return trimSlashesBlock(normalizedInput)
  }

  const inferredRelativePath = deriveRelativeExecutionPathFromAbsoluteBlock(normalizedInput)

  const storedVaultRoot = getStoredVaultRoot()
  if (!storedVaultRoot) {
    if (inferredRelativePath) return inferredRelativePath
    throw new Error('Vault root is not selected yet. Set a vault root or configure a relative F9 execution folder path.')
  }

  const normalizedVaultRoot = normalizeSlashPathBlock(removeFileSchemeBlock(storedVaultRoot).trim())
  if (!normalizedVaultRoot.startsWith('/')) {
    if (inferredRelativePath) return inferredRelativePath
    throw new Error('Absolute F9 execution folder requires an absolute vault root.')
  }

  if (normalizedInput === normalizedVaultRoot) {
    return ''
  }
  const vaultPrefix = `${normalizedVaultRoot}/`
  if (!normalizedInput.startsWith(vaultPrefix)) {
    if (inferredRelativePath) return inferredRelativePath
    throw new Error(`F9 execution folder must be inside the selected vault root: ${normalizedVaultRoot}`)
  }
  return normalizedInput.slice(vaultPrefix.length)
}

function deriveRelativeExecutionPathFromAbsoluteBlock(absolutePath: string): string | null {
  const lowered = absolutePath.toLowerCase()
  for (const hint of F9_RELATIVE_ROOT_HINTS_BLOCK) {
    const idx = lowered.indexOf(`/${hint}`)
    if (idx < 0) continue
    const candidate = trimSlashesBlock(absolutePath.slice(idx + 1))
    if (candidate) return candidate
  }
  return null
}

export async function syncF9ExecutionStorageBlock(
  input: SyncF9ExecutionInputBlock,
): Promise<SyncF9ExecutionResultBlock> {
  const fs = input.fs ?? getVaultFS()
  const executionRoot = resolveF9ExecutionRootForVaultBlock(input.executionFolderPath)
  const warnings: string[] = []
  await ensureDirBlock(fs, executionRoot)

  const selected = resolvePrimaryPositionsPayloadBlock(input.assetsPositions, input.accountPositionsLegacy)
  const rows = selected.rows

  const overallPayload = {
    fetched_at: input.fetchedAt,
    runtime: input.runtime,
    selected_account: input.selectedAccount,
    source: selected.source,
    positions_payload: selected.payload,
    account_list: input.accountList,
    account_balance_legacy: input.accountBalanceLegacy,
    account_positions_legacy: input.accountPositionsLegacy,
    assets_positions: input.assetsPositions,
  }

  const overallPath = joinPathBlock(executionRoot, 'overall.json')
  await fs.write(overallPath, `${JSON.stringify(overallPayload, null, 2)}\n`)

  if (rows.length === 0) {
    return {
      executionRoot,
      overallPath,
      companyCount: 0,
      positionCount: 0,
      source: selected.source,
      warnings,
    }
  }

  const groupedRows = new Map<string, Array<Record<string, unknown>>>()
  for (const row of rows) {
    const ticker = resolveTickerForRowBlock(row)
    if (!ticker) {
      warnings.push('Skipped a position row without symbol/ticker.')
      continue
    }
    const bucket = groupedRows.get(ticker) ?? []
    bucket.push(row)
    groupedRows.set(ticker, bucket)
  }

  let totalPositions = 0
  const companyTickers = [...groupedRows.keys()].sort((a, b) => a.localeCompare(b))
  for (const ticker of companyTickers) {
    const companyDir = joinPathBlock(executionRoot, ticker)
    const positionsDir = joinPathBlock(companyDir, 'positions')
    await ensureDirBlock(fs, companyDir)
    await ensureDirBlock(fs, positionsDir)

    const indexId = `${ticker}-index`
    const existingRecords = await readExistingPositionRecordsBlock(fs, positionsDir)
    const existingById = new Map(existingRecords.map((record) => [record.id, record]))

    for (const row of groupedRows.get(ticker) ?? []) {
      const next = await upsertPositionRecordBlock({
        fs,
        companyTicker: ticker,
        indexId,
        positionsDir,
        row,
        existingById,
      })
      existingById.set(next.id, next)
      totalPositions += 1
    }

    const mergedSummaries = [...existingById.values()]
      .map((record) => record.summary)
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
    await upsertCompanyIndexBlock({
      fs,
      companyDir,
      ticker,
      indexId,
      summaries: mergedSummaries,
    })
  }

  return {
    executionRoot,
    overallPath,
    companyCount: companyTickers.length,
    positionCount: totalPositions,
    source: selected.source,
    warnings,
  }
}

export async function readF9ExecutionOverviewBlock(
  executionFolderPath: string,
  fsParam?: VaultFS,
): Promise<F9ExecutionOverviewBlock> {
  const fs = fsParam ?? getVaultFS()
  const executionRoot = resolveF9ExecutionRootForVaultBlock(executionFolderPath)
  const exists = await fs.exists(executionRoot)
  if (!exists) {
    return {
      executionRoot,
      companyCount: 0,
      positionCount: 0,
      companies: [],
    }
  }

  const listedRoot = await fs.list(executionRoot)
  const companies: F9CompanyOverviewBlock[] = []

  for (const folder of listedRoot.folders) {
    const ticker = normalizeTickerBlock(folder)
    if (!ticker) continue
    const companyDir = joinPathBlock(executionRoot, folder)
    const indexFileName = `${ticker}-index.md`
    const indexFilePath = joinPathBlock(companyDir, indexFileName)
    if (!(await fs.exists(indexFilePath))) continue

    const parsed = parseMarkdownFrontmatterBlock(await fs.read(indexFilePath))
    const frontmatter = parsed.frontmatter
    const positions = asPositionSummaryListBlock(frontmatter.positions)
    const strategyNotes = readStringFieldBlock(frontmatter.strategy_notes)
    const relatedIdeaIds = readStringArrayFieldBlock(frontmatter.related_idea_ids)
    const indexId = readStringFieldBlock(frontmatter.id) || `${ticker}-index`
    companies.push({
      companyTicker: ticker,
      indexFilePath,
      indexId,
      strategyNotes,
      relatedIdeaIds,
      positions,
    })
  }

  companies.sort((a, b) => a.companyTicker.localeCompare(b.companyTicker))
  const positionCount = companies.reduce((count, company) => count + company.positions.length, 0)
  return {
    executionRoot,
    companyCount: companies.length,
    positionCount,
    companies,
  }
}

export async function readF9OverallCacheBlock(
  executionFolderPath: string,
  fsParam?: VaultFS,
): Promise<F9OverallCacheBlock | null> {
  const fs = fsParam ?? getVaultFS()
  const executionRoot = resolveF9ExecutionRootForVaultBlock(executionFolderPath)
  const overallPath = joinPathBlock(executionRoot, 'overall.json')
  if (!(await fs.exists(overallPath))) return null

  let parsed: Record<string, unknown> = {}
  try {
    const raw = await fs.read(overallPath)
    const candidate = JSON.parse(raw)
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      parsed = candidate as Record<string, unknown>
    }
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Failed to parse F9 overall cache at ${overallPath}: ${err.message}`
        : `Failed to parse F9 overall cache at ${overallPath}.`,
    )
  }

  const sourceRaw = readStringFieldBlock(parsed.source)
  const source: 'assets_positions' | 'legacy_positions' | 'none' = (
    sourceRaw === 'assets_positions'
      ? 'assets_positions'
      : sourceRaw === 'legacy_positions'
        ? 'legacy_positions'
        : 'none'
  )

  return {
    overallPath,
    fetchedAt: readStringFieldBlock(parsed.fetched_at),
    runtime: readStringFieldBlock(parsed.runtime),
    selectedAccount: parsed.selected_account ?? null,
    accountList: parsed.account_list ?? null,
    accountBalanceLegacy: parsed.account_balance_legacy ?? null,
    accountPositionsLegacy: parsed.account_positions_legacy ?? null,
    assetsPositions: parsed.assets_positions ?? null,
    source,
  }
}

export async function readF9PositionDetailBlock(
  input: {
    executionFolderPath: string
    companyTicker: string
    fileName: string
    fs?: VaultFS
  },
): Promise<F9PositionDetailBlock> {
  const fs = input.fs ?? getVaultFS()
  const executionRoot = resolveF9ExecutionRootForVaultBlock(input.executionFolderPath)
  const ticker = normalizeTickerBlock(input.companyTicker)
  if (!ticker) {
    throw new Error(`Invalid company ticker: ${input.companyTicker}`)
  }
  const fileName = sanitizeFileNameBlock(input.fileName)
  const filePath = joinPathBlock(executionRoot, ticker, 'positions', fileName)
  const parsed = parseMarkdownFrontmatterBlock(await fs.read(filePath))
  const summary = buildPositionSummaryFromFrontmatterBlock(parsed.frontmatter, fileName, ticker)
  return {
    companyTicker: ticker,
    filePath,
    summary,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
  }
}

export async function createF9CompanyBlock(
  input: CreateF9CompanyInputBlock,
): Promise<F9CompanyOverviewBlock> {
  const fs = input.fs ?? getVaultFS()
  const executionRoot = resolveF9ExecutionRootForVaultBlock(input.executionFolderPath)
  const ticker = normalizeTickerBlock(input.companyTicker)
  if (!ticker) throw new Error(`Invalid company ticker: ${input.companyTicker}`)
  const companyDir = joinPathBlock(executionRoot, ticker)
  const positionsDir = joinPathBlock(companyDir, 'positions')
  await ensureDirBlock(fs, executionRoot)
  await ensureDirBlock(fs, companyDir)
  await ensureDirBlock(fs, positionsDir)
  await upsertCompanyIndexBlock({
    fs,
    companyDir,
    ticker,
    indexId: `${ticker}-index`,
    summaries: await readExistingPositionRecordsBlock(fs, positionsDir).then((records) => records.map((record) => record.summary)),
  })
  const overview = await readF9ExecutionOverviewBlock(input.executionFolderPath, fs)
  const company = overview.companies.find((row) => row.companyTicker === ticker)
  if (!company) {
    throw new Error(`Failed to create company index for ${ticker}`)
  }
  return company
}

export async function createF9ManualPositionBlock(
  input: CreateF9ManualPositionInputBlock,
): Promise<F9PositionSummaryBlock> {
  const fs = input.fs ?? getVaultFS()
  const ticker = normalizeTickerBlock(input.companyTicker)
  if (!ticker) throw new Error(`Invalid company ticker: ${input.companyTicker}`)

  const company = await createF9CompanyBlock({
    executionFolderPath: input.executionFolderPath,
    companyTicker: ticker,
    fs,
  })
  const executionRoot = resolveF9ExecutionRootForVaultBlock(input.executionFolderPath)
  const companyDir = joinPathBlock(executionRoot, ticker)
  const positionsDir = joinPathBlock(companyDir, 'positions')
  const existingRecords = await readExistingPositionRecordsBlock(fs, positionsDir)
  const existingById = new Map(existingRecords.map((record) => [record.id, record]))

  const instrumentType = (input.instrumentType ?? 'STOCK').toUpperCase() === 'OPTION' ? 'OPTION' : 'STOCK'
  const status = normalizePositionStatusBlock(input.status ?? 'planned')
  const positionId = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const manualRow: Record<string, unknown> = {
    id: positionId,
    symbol: ticker,
    instrument_type: instrumentType,
    option_type: instrumentType === 'OPTION' ? readStringFieldBlock(input.optionType) : '',
    option_expire_date: instrumentType === 'OPTION' ? readStringFieldBlock(input.optionExpireDate) : '',
    option_exercise_price: instrumentType === 'OPTION' ? readStringFieldBlock(input.optionExercisePrice) : '',
    status,
    source: 'manual',
  }

  const preferredFileName = buildPreferredFileNameBlock(manualRow, ticker, positionId)
  let fileName = preferredFileName
  let filePath = joinPathBlock(positionsDir, fileName)
  if (await fs.exists(filePath)) {
    fileName = appendFileNameSuffixBlock(preferredFileName, positionId.slice(-6))
    filePath = joinPathBlock(positionsDir, fileName)
  }

  const now = new Date().toISOString()
  const title = readStringFieldBlock(input.title) || removeMdExtensionBlock(fileName)
  const notes = readStringFieldBlock(input.notes)
  const body = notes
    ? `## Notes\n\n${notes}\n\n## Comments\n`
    : DEFAULT_POSITION_BODY_BLOCK
  const frontmatter: Record<string, unknown> = {
    id: positionId,
    parent_id: company.indexId,
    title,
    symbol: ticker,
    company_ticker: ticker,
    source: 'manual',
    status,
    instrument_type: instrumentType,
    option_type: instrumentType === 'OPTION' ? readNullableStringFieldBlock(input.optionType) : null,
    option_expire_date: instrumentType === 'OPTION' ? readNullableStringFieldBlock(input.optionExpireDate) : null,
    option_exercise_price: instrumentType === 'OPTION' ? readNullableStringFieldBlock(input.optionExercisePrice) : null,
    linked_idea_id: readNullableStringFieldBlock(input.linkedIdeaId),
    created_at: now,
    updated_at: now,
    history: [
      {
        at: now,
        type: 'create',
        source: 'manual',
        note: 'Created manually from F9 workspace.',
      },
    ],
  }
  await fs.write(filePath, stringifyMarkdownFrontmatterBlock(frontmatter, body))
  const createdSummary = buildPositionSummaryFromFrontmatterBlock(frontmatter, fileName, ticker)
  existingById.set(createdSummary.id, {
    id: createdSummary.id,
    fileName,
    filePath,
    frontmatter,
    body,
    summary: createdSummary,
  })
  await upsertCompanyIndexBlock({
    fs,
    companyDir,
    ticker,
    indexId: company.indexId,
    summaries: [...existingById.values()].map((record) => record.summary).sort((a, b) => a.fileName.localeCompare(b.fileName)),
  })
  return createdSummary
}

export async function updateF9PositionOverlayBlock(
  input: UpdateF9PositionOverlayInputBlock,
): Promise<F9PositionDetailBlock> {
  const fs = input.fs ?? getVaultFS()
  const detail = await readF9PositionDetailBlock({
    executionFolderPath: input.executionFolderPath,
    companyTicker: input.companyTicker,
    fileName: input.fileName,
    fs,
  })
  const now = new Date().toISOString()
  const nextFrontmatter: Record<string, unknown> = {
    ...detail.frontmatter,
    updated_at: now,
  }
  const changedFields: string[] = []
  if (input.status) {
    nextFrontmatter.status = normalizePositionStatusBlock(input.status)
    changedFields.push('status')
  }
  if (input.linkedIdeaId !== undefined) {
    const normalizedLinkedIdea = readNullableStringFieldBlock(input.linkedIdeaId)
    if (normalizedLinkedIdea) nextFrontmatter.linked_idea_id = normalizedLinkedIdea
    else delete nextFrontmatter.linked_idea_id
    changedFields.push('linked_idea_id')
  }
  if (input.title !== undefined) {
    const normalizedTitle = readStringFieldBlock(input.title)
    if (normalizedTitle) nextFrontmatter.title = normalizedTitle
    else delete nextFrontmatter.title
    changedFields.push('title')
  }
  if (input.priority !== undefined) {
    const normalizedPriority = normalizePriorityBlock(input.priority)
    if (normalizedPriority) nextFrontmatter.priority = normalizedPriority
    else delete nextFrontmatter.priority
    changedFields.push('priority')
  }
  if (input.description !== undefined) {
    const normalizedDescription = readStringFieldBlock(input.description)
    if (normalizedDescription) nextFrontmatter.description = normalizedDescription
    else delete nextFrontmatter.description
    changedFields.push('description')
  }
  if (input.comments !== undefined) {
    const normalizedComments = normalizeCommentEntriesBlock(input.comments)
    if (normalizedComments.length > 0) nextFrontmatter.comments = normalizedComments
    else delete nextFrontmatter.comments
    changedFields.push('comments')
  }
  if (input.tags !== undefined) {
    const normalizedTags = normalizeTagListBlock(input.tags)
    if (normalizedTags.length > 0) nextFrontmatter.tags = normalizedTags
    else delete nextFrontmatter.tags
    changedFields.push('tags')
  }
  if (input.projectPresetTags !== undefined) {
    const normalizedProjectPresetTags = normalizeTagListBlock(input.projectPresetTags)
    if (normalizedProjectPresetTags.length > 0) nextFrontmatter.project_preset_tags = normalizedProjectPresetTags
    else delete nextFrontmatter.project_preset_tags
    changedFields.push('project_preset_tags')
  }
  const history = asHistoryEntryListBlock(nextFrontmatter.history)
  history.push({
    at: now,
    type: 'overlay_update',
    source: 'manual',
    note: changedFields.length > 0
      ? `Updated ${changedFields.join(', ')} in F9 workspace.`
      : 'Updated metadata in F9 workspace.',
  })
  nextFrontmatter.history = history.slice(-80)
  await fs.write(detail.filePath, stringifyMarkdownFrontmatterBlock(nextFrontmatter, detail.body))
  await refreshCompanyIndexFromPositionsBlock({
    fs,
    executionFolderPath: input.executionFolderPath,
    companyTicker: detail.companyTicker,
  })
  return {
    ...detail,
    summary: buildPositionSummaryFromFrontmatterBlock(nextFrontmatter, detail.summary.fileName, detail.companyTicker),
    frontmatter: nextFrontmatter,
  }
}

export async function saveF9PositionBodyBlock(
  input: SaveF9PositionBodyInputBlock,
): Promise<F9PositionDetailBlock> {
  const fs = input.fs ?? getVaultFS()
  const detail = await readF9PositionDetailBlock({
    executionFolderPath: input.executionFolderPath,
    companyTicker: input.companyTicker,
    fileName: input.fileName,
    fs,
  })
  const now = new Date().toISOString()
  const nextFrontmatter: Record<string, unknown> = {
    ...detail.frontmatter,
    updated_at: now,
  }
  const history = asHistoryEntryListBlock(nextFrontmatter.history)
  history.push({
    at: now,
    type: 'body_update',
    source: 'manual',
    note: 'Updated notes/comments body in F9 workspace.',
  })
  nextFrontmatter.history = history.slice(-80)
  const body = input.body ?? ''
  await fs.write(detail.filePath, stringifyMarkdownFrontmatterBlock(nextFrontmatter, body))
  return {
    ...detail,
    frontmatter: nextFrontmatter,
    body,
  }
}

async function upsertCompanyIndexBlock(input: {
  fs: VaultFS
  companyDir: string
  ticker: string
  indexId: string
  summaries: F9PositionSummaryBlock[]
}): Promise<void> {
  const { fs, companyDir, ticker, indexId, summaries } = input
  const indexFilePath = joinPathBlock(companyDir, `${ticker}-index.md`)
  let existingFrontmatter: Record<string, unknown> = {}
  let existingBody = ''

  if (await fs.exists(indexFilePath)) {
    const parsed = parseMarkdownFrontmatterBlock(await fs.read(indexFilePath))
    existingFrontmatter = parsed.frontmatter
    existingBody = parsed.body
  }

  const now = new Date().toISOString()
  const nextFrontmatter: Record<string, unknown> = {
    ...existingFrontmatter,
    id: indexId,
    parent_id: null,
    title: `${ticker} index`,
    company_ticker: ticker,
    source: 'f9-execution-sync',
    strategy_notes: readStringFieldBlock(existingFrontmatter.strategy_notes),
    related_idea_ids: readStringArrayFieldBlock(existingFrontmatter.related_idea_ids),
    position_count: summaries.length,
    updated_at: now,
    positions: summaries.map((summary) => ({
      id: summary.id,
      file_name: summary.fileName,
      symbol: summary.symbol,
      status: summary.status,
      source: summary.source,
      instrument_type: summary.instrumentType,
      option_type: summary.optionType,
      option_expire_date: summary.optionExpireDate,
      option_exercise_price: summary.optionExercisePrice,
      cost: summary.cost,
      proportion: summary.proportion,
      last_price: summary.lastPrice,
      unrealized_profit_loss: summary.unrealizedProfitLoss,
      day_profit_loss: summary.dayProfitLoss,
      linked_idea_id: summary.linkedIdeaId,
      tags: summary.tags,
      project_preset_tags: summary.projectPresetTags,
    })),
  }

  const body = existingBody.trim() ? existingBody : DEFAULT_COMPANY_INDEX_BODY_BLOCK
  await fs.write(indexFilePath, stringifyMarkdownFrontmatterBlock(nextFrontmatter, body))
}

async function upsertPositionRecordBlock(input: {
  fs: VaultFS
  companyTicker: string
  indexId: string
  positionsDir: string
  row: Record<string, unknown>
  existingById: Map<string, ExistingPositionRecordBlock>
}): Promise<ExistingPositionRecordBlock> {
  const { fs, companyTicker, indexId, positionsDir, row, existingById } = input
  const normalizedRow = normalizePositionRowForStorageBlock(row, companyTicker)
  const positionId = resolvePositionIdBlock(normalizedRow, companyTicker)
  const existing = existingById.get(positionId)
  const preferredFileName = buildPreferredFileNameBlock(normalizedRow, companyTicker, positionId)
  let fileName = preferredFileName
  let filePath = joinPathBlock(positionsDir, fileName)

  if (await fs.exists(filePath)) {
    const parsedTarget = parseMarkdownFrontmatterBlock(await fs.read(filePath))
    const targetId = resolvePositionIdBlock(parsedTarget.frontmatter, companyTicker)
    if (targetId && targetId !== positionId) {
      const suffix = sanitizeFileFragmentBlock(positionId).slice(0, 12) || 'position'
      fileName = appendFileNameSuffixBlock(preferredFileName, suffix)
      filePath = joinPathBlock(positionsDir, fileName)
    }
  }

  let existingFrontmatter: Record<string, unknown> = {}
  let existingBody = ''
  if (existing && existing.fileName === fileName) {
    existingFrontmatter = existing.frontmatter
    existingBody = existing.body
  } else if (await fs.exists(filePath)) {
    const parsed = parseMarkdownFrontmatterBlock(await fs.read(filePath))
    existingFrontmatter = parsed.frontmatter
    existingBody = parsed.body
  } else if (existing) {
    // Existing record uses legacy file name; migrate to canonical name by writing a canonical file.
    existingFrontmatter = existing.frontmatter
    existingBody = existing.body
  }

  const now = new Date().toISOString()
  const history = asHistoryEntryListBlock(existingFrontmatter.history)
  history.push({
    at: now,
    type: 'sync',
    source: 'webull-overall',
    note: 'Synced from F9 overall positions payload.',
  })

  const nextFrontmatter: Record<string, unknown> = {
    ...existingFrontmatter,
    ...normalizedRow,
    id: positionId,
    parent_id: indexId,
    title: readStringFieldBlock(existingFrontmatter.title) || removeMdExtensionBlock(fileName),
    symbol: companyTicker,
    company_ticker: companyTicker,
    source: 'webull',
    status: normalizePositionStatusBlock(
      readStringFieldBlock(existingFrontmatter.status)
      || readStringFieldBlock(row.status)
      || readStringFieldBlock(row.position_status)
      || 'taken',
    ),
    linked_idea_id: readNullableStringFieldBlock(existingFrontmatter.linked_idea_id),
    created_at: readStringFieldBlock(existingFrontmatter.created_at) || now,
    updated_at: now,
    last_synced_at: now,
    webull_id: readStringFieldBlock(normalizedRow.leg_id)
      || readStringFieldBlock(normalizedRow.position_id)
      || readStringFieldBlock(normalizedRow.instrument_id)
      || positionId,
    history: history.slice(-80),
  }

  const body = existingBody.trim() ? existingBody : DEFAULT_POSITION_BODY_BLOCK
  await fs.write(filePath, stringifyMarkdownFrontmatterBlock(nextFrontmatter, body))
  const summary = buildPositionSummaryFromFrontmatterBlock(nextFrontmatter, fileName, companyTicker)
  return {
    id: positionId,
    fileName,
    filePath,
    frontmatter: nextFrontmatter,
    body,
    summary,
  }
}

async function readExistingPositionRecordsBlock(
  fs: VaultFS,
  positionsDir: string,
): Promise<ExistingPositionRecordBlock[]> {
  const records: ExistingPositionRecordBlock[] = []
  if (!(await fs.exists(positionsDir))) return records
  const listed = await fs.list(positionsDir)
  for (const fileName of listed.files) {
    if (!fileName.toLowerCase().endsWith('.md')) continue
    const filePath = joinPathBlock(positionsDir, fileName)
    const parsed = parseMarkdownFrontmatterBlock(await fs.read(filePath))
    const summary = buildPositionSummaryFromFrontmatterBlock(parsed.frontmatter, fileName)
    records.push({
      id: summary.id,
      fileName,
      filePath,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      summary,
    })
  }
  const dedupedById = new Map<string, ExistingPositionRecordBlock>()
  for (const record of records) {
    const current = dedupedById.get(record.id)
    if (!current) {
      dedupedById.set(record.id, record)
      continue
    }
    const preferredFileName = buildPreferredFileNameBlock(
      normalizePositionRowForStorageBlock(record.frontmatter, record.summary.symbol),
      record.summary.symbol,
      record.id,
    )
    const currentScore = existingRecordPreferenceScoreBlock(current, preferredFileName)
    const nextScore = existingRecordPreferenceScoreBlock(record, preferredFileName)
    if (nextScore > currentScore) {
      dedupedById.set(record.id, record)
    }
  }
  return [...dedupedById.values()]
}

function existingRecordPreferenceScoreBlock(
  record: ExistingPositionRecordBlock,
  preferredFileName: string,
): number {
  let score = 0
  if (record.fileName === preferredFileName) score += 1000
  const updatedAt = Date.parse(readStringFieldBlock(record.frontmatter.updated_at))
  if (Number.isFinite(updatedAt)) score += Math.floor(updatedAt / 1000)
  return score
}

async function refreshCompanyIndexFromPositionsBlock(input: {
  fs: VaultFS
  executionFolderPath: string
  companyTicker: string
}): Promise<void> {
  const { fs } = input
  const executionRoot = resolveF9ExecutionRootForVaultBlock(input.executionFolderPath)
  const ticker = normalizeTickerBlock(input.companyTicker)
  if (!ticker) return
  const companyDir = joinPathBlock(executionRoot, ticker)
  const positionsDir = joinPathBlock(companyDir, 'positions')
  const records = await readExistingPositionRecordsBlock(fs, positionsDir)
  await upsertCompanyIndexBlock({
    fs,
    companyDir,
    ticker,
    indexId: `${ticker}-index`,
    summaries: records.map((record) => record.summary).sort((a, b) => a.fileName.localeCompare(b.fileName)),
  })
}

function buildPositionSummaryFromFrontmatterBlock(
  frontmatter: Record<string, unknown>,
  fileName: string,
  fallbackTicker?: string,
): F9PositionSummaryBlock {
  const symbol = normalizeTickerBlock(
    frontmatter.symbol
    ?? frontmatter.position_symbol
    ?? frontmatter.company_ticker
    ?? fallbackTicker,
  ) ?? 'UNKNOWN'

  const id = readStringFieldBlock(frontmatter.id)
    || readStringFieldBlock(frontmatter.leg_id)
    || readStringFieldBlock(frontmatter.instrument_id)
    || removeMdExtensionBlock(fileName)

  return {
    id,
    fileName,
    symbol,
    status: normalizePositionStatusBlock(readStringFieldBlock(frontmatter.status) || 'taken'),
    source: readStringFieldBlock(frontmatter.source) || 'manual',
    instrumentType: readNullableStringFieldBlock(frontmatter.instrument_type),
    optionType: readNullableStringFieldBlock(frontmatter.option_type),
    optionExpireDate: readNullableStringFieldBlock(frontmatter.option_expire_date),
    optionExercisePrice: readNullableStringFieldBlock(frontmatter.option_exercise_price),
    cost: readNullableStringFieldBlock(frontmatter.cost),
    proportion: readNullableStringFieldBlock(frontmatter.proportion),
    lastPrice: readNullableStringFieldBlock(frontmatter.last_price),
    unrealizedProfitLoss: readNullableStringFieldBlock(frontmatter.unrealized_profit_loss),
    dayProfitLoss: readNullableStringFieldBlock(frontmatter.day_profit_loss),
    linkedIdeaId: readNullableStringFieldBlock(frontmatter.linked_idea_id),
    tags: normalizeTagListBlock(readStringArrayFieldBlock(frontmatter.tags)),
    projectPresetTags: normalizeTagListBlock(readStringArrayFieldBlock(frontmatter.project_preset_tags)),
  }
}

function asPositionSummaryListBlock(value: unknown): F9PositionSummaryBlock[] {
  if (!Array.isArray(value)) return []
  const list: F9PositionSummaryBlock[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const fileName = sanitizeFileNameBlock(readStringFieldBlock(record.file_name) || 'unknown.md')
    list.push({
      id: readStringFieldBlock(record.id) || removeMdExtensionBlock(fileName),
      fileName,
      symbol: normalizeTickerBlock(record.symbol) || 'UNKNOWN',
      status: normalizePositionStatusBlock(readStringFieldBlock(record.status) || 'taken'),
      source: readStringFieldBlock(record.source) || 'manual',
      instrumentType: readNullableStringFieldBlock(record.instrument_type),
      optionType: readNullableStringFieldBlock(record.option_type),
      optionExpireDate: readNullableStringFieldBlock(record.option_expire_date),
      optionExercisePrice: readNullableStringFieldBlock(record.option_exercise_price),
      cost: readNullableStringFieldBlock(record.cost),
      proportion: readNullableStringFieldBlock(record.proportion),
      lastPrice: readNullableStringFieldBlock(record.last_price),
      unrealizedProfitLoss: readNullableStringFieldBlock(record.unrealized_profit_loss),
      dayProfitLoss: readNullableStringFieldBlock(record.day_profit_loss),
      linkedIdeaId: readNullableStringFieldBlock(record.linked_idea_id),
      tags: normalizeTagListBlock(readStringArrayFieldBlock(record.tags)),
      projectPresetTags: normalizeTagListBlock(readStringArrayFieldBlock(record.project_preset_tags)),
    })
  }
  return list
}

function resolvePrimaryPositionsPayloadBlock(
  assetsPositions: unknown | null,
  legacyPositions: unknown | null,
): {
  payload: unknown | null
  rows: Array<Record<string, unknown>>
  source: 'assets_positions' | 'legacy_positions' | 'none'
} {
  const assetRows = extractPositionRowsBlock(assetsPositions)
  if (assetRows.length > 0) {
    return {
      payload: assetsPositions,
      rows: assetRows,
      source: 'assets_positions',
    }
  }

  const legacyRows = extractPositionRowsBlock(legacyPositions)
  if (legacyRows.length > 0) {
    return {
      payload: legacyPositions,
      rows: legacyRows,
      source: 'legacy_positions',
    }
  }

  return {
    payload: assetsPositions ?? legacyPositions,
    rows: [],
    source: 'none',
  }
}

function extractPositionRowsBlock(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  }
  if (!data || typeof data !== 'object') return []
  const record = data as Record<string, unknown>
  for (const key of POSITION_PAYLOAD_KEYS_BLOCK) {
    const nested = record[key]
    if (Array.isArray(nested)) {
      return nested.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    }
  }
  return []
}

function resolveTickerForRowBlock(row: Record<string, unknown>): string | null {
  const raw = readStringFieldBlock(row.symbol)
    || readStringFieldBlock(row.ticker)
    || readStringFieldBlock(row.position_symbol)
    || readStringFieldBlock(row.stock_code)
  return normalizeTickerBlock(raw)
}

function normalizePositionRowForStorageBlock(
  row: Record<string, unknown>,
  fallbackTicker: string,
): Record<string, unknown> {
  const firstLeg = readFirstLegRecordBlock(row)
  const symbol = normalizeTickerBlock(
    readFirstStringFromFieldsBlock(row, firstLeg, ['symbol', 'ticker', 'position_symbol', 'stock_code']),
  ) ?? fallbackTicker
  const optionType = normalizeMissingTokenBlock(
    readFirstStringFromFieldsBlock(row, firstLeg, ['option_type', 'optionType']),
  ).toUpperCase()
  const instrumentTypeRaw = normalizeMissingTokenBlock(
    readFirstStringFromFieldsBlock(row, firstLeg, ['instrument_type', 'instrumentType']),
  ).toUpperCase()
  const instrumentType = instrumentTypeRaw
    || (optionType ? 'OPTION' : 'STOCK')

  return {
    ...firstLeg,
    ...row,
    symbol,
    cost: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['cost', 'avg_cost', 'average_cost', 'cost_price'])),
    proportion: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['proportion', 'weight'])),
    leg_id: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['leg_id', 'legId'])),
    position_id: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['position_id', 'positionId'])),
    instrument_id: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['instrument_id', 'instrumentId'])),
    instrument_type: instrumentType,
    last_price: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['last_price', 'lastPrice', 'price', 'latest_price'])),
    unrealized_profit_loss: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['unrealized_profit_loss', 'unrealizedProfitLoss'])),
    day_profit_loss: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['day_profit_loss', 'dayProfitLoss'])),
    day_realized_profit_loss: normalizeMissingTokenBlock(readFirstStringFromFieldsBlock(row, firstLeg, ['day_realized_profit_loss', 'dayRealizedProfitLoss'])),
    option_type: optionType,
    option_expire_date: normalizeMissingTokenBlock(
      readFirstStringFromFieldsBlock(row, firstLeg, ['option_expire_date', 'optionExpireDate', 'expire_date', 'expiry']),
    ),
    option_exercise_price: normalizeMissingTokenBlock(
      readFirstStringFromFieldsBlock(row, firstLeg, ['option_exercise_price', 'optionExercisePrice', 'strike', 'strike_price']),
    ),
    option_contract_multiplier: normalizeMissingTokenBlock(
      readFirstStringFromFieldsBlock(row, firstLeg, ['option_contract_multiplier', 'optionContractMultiplier']),
    ),
    option_contract_deliverable: normalizeMissingTokenBlock(
      readFirstStringFromFieldsBlock(row, firstLeg, ['option_contract_deliverable', 'optionContractDeliverable']),
    ),
    expiration_type: normalizeMissingTokenBlock(
      readFirstStringFromFieldsBlock(row, firstLeg, ['expiration_type', 'expirationType']),
    ),
  }
}

function readFirstLegRecordBlock(row: Record<string, unknown>): Record<string, unknown> | null {
  const legs = row.legs
  if (!Array.isArray(legs)) return null
  const first = legs.find(item => !!item && typeof item === 'object')
  if (!first || typeof first !== 'object') return null
  return first as Record<string, unknown>
}

function readFirstStringFromFieldsBlock(
  topLevel: Record<string, unknown>,
  nested: Record<string, unknown> | null,
  keys: string[],
): string {
  for (const key of keys) {
    const value = readStringFieldBlock(topLevel[key])
    if (value) return value
  }
  if (!nested) return ''
  for (const key of keys) {
    const value = readStringFieldBlock(nested[key])
    if (value) return value
  }
  return ''
}

function normalizeMissingTokenBlock(value: string): string {
  const normalized = value.trim()
  if (!normalized) return ''
  const upper = normalized.toUpperCase()
  if (upper === '—' || upper === '-' || upper === '--' || upper === 'N/A' || upper === 'NA' || upper === 'NULL') {
    return ''
  }
  return normalized
}

function resolvePositionIdBlock(row: Record<string, unknown>, ticker: string): string {
  const fromPayload = readStringFieldBlock(row.leg_id)
    || readStringFieldBlock(row.position_id)
    || readStringFieldBlock(row.instrument_id)
    || readStringFieldBlock(row.ticker_id)
    || readStringFieldBlock(row.id)
  if (fromPayload) return fromPayload
  const stockSuffix = isStockRowBlock(row) ? 'stock' : 'position'
  return `${ticker}-${stockSuffix}`
}

function buildPreferredFileNameBlock(
  row: Record<string, unknown>,
  ticker: string,
  positionId: string,
): string {
  const optionType = sanitizeFileFragmentBlock(normalizeMissingTokenBlock(readStringFieldBlock(row.option_type)).toUpperCase())
  const optionExpireDate = sanitizeFileFragmentBlock(normalizeMissingTokenBlock(readStringFieldBlock(row.option_expire_date)))
  const strike = normalizeStrikeForFileNameBlock(normalizeMissingTokenBlock(readStringFieldBlock(row.option_exercise_price)))
  if (optionType && optionExpireDate && strike) {
    return `${ticker}${strike}-${optionExpireDate}-${optionType}.md`
  }
  if (isStockRowBlock(row)) {
    return `${ticker}STOCK.md`
  }
  const suffix = sanitizeFileFragmentBlock(positionId) || 'position'
  return `${ticker}-${suffix}.md`
}

function isStockRowBlock(row: Record<string, unknown>): boolean {
  const instrumentType = readStringFieldBlock(row.instrument_type)?.toUpperCase() ?? ''
  if (instrumentType.includes('OPTION')) return false
  if (instrumentType.includes('STOCK')) return true
  return !normalizeMissingTokenBlock(readStringFieldBlock(row.option_type))
}

function normalizeStrikeForFileNameBlock(value: string): string {
  if (!value) return ''
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    if (Number.isInteger(numeric)) return String(numeric)
    return String(numeric).replace('.', 'p')
  }
  return sanitizeFileFragmentBlock(value)
}

function parseMarkdownFrontmatterBlock(content: string): ParsedMarkdownFrontmatterBlock {
  const openMatch = /^---\r?\n/.exec(content)
  if (!openMatch) {
    return { frontmatter: {}, body: content }
  }
  const rest = content.slice(openMatch[0].length)
  const closeMatch = /\r?\n---(?:\r?\n|$)/.exec(rest)
  if (!closeMatch || closeMatch.index === undefined) {
    return { frontmatter: {}, body: content }
  }

  const yamlStr = rest.slice(0, closeMatch.index)
  const afterClose = rest.slice(closeMatch.index + closeMatch[0].length)
  let frontmatter: Record<string, unknown> = {}
  try {
    const parsed = yaml.load(yamlStr)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      frontmatter = parsed as Record<string, unknown>
    }
  } catch {
    frontmatter = {}
  }
  return {
    frontmatter,
    body: afterClose,
  }
}

function stringifyMarkdownFrontmatterBlock(frontmatter: Record<string, unknown>, body: string): string {
  const yamlBody = yaml.dump(frontmatter, {
    sortKeys: false,
    lineWidth: -1,
    noRefs: true,
  }).trimEnd()
  const normalizedBody = body.replace(/^\n+/, '')
  if (!normalizedBody) {
    return `---\n${yamlBody}\n---\n`
  }
  return `---\n${yamlBody}\n---\n\n${normalizedBody}`
}

function asHistoryEntryListBlock(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
}

function readStringFieldBlock(value: unknown): string {
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized) return normalized
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function readNullableStringFieldBlock(value: unknown): string | null {
  const normalized = readStringFieldBlock(value)
  return normalized || null
}

function readStringArrayFieldBlock(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => readStringFieldBlock(item))
    .filter((item) => !!item)
}

function normalizeCommentEntriesBlock(value: unknown): YAMLCommentEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const candidate = entry as Record<string, unknown>
      const text = readStringFieldBlock(candidate.text)
      if (!text) return []
      const comment: YAMLCommentEntry = { text }
      const addedAt = readStringFieldBlock(candidate.added_at)
      if (addedAt) comment.added_at = addedAt
      const addedBy = readStringFieldBlock(candidate.added_by)
      if (addedBy) comment.added_by = addedBy
      return [comment]
    })
}

function normalizePriorityBlock(value: unknown): NodePriority | null {
  const normalized = readStringFieldBlock(value).toLowerCase()
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
    return normalized
  }
  return null
}

function normalizePositionStatusBlock(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'taken'
  if (normalized === 'planned' || normalized === 'watchlist' || normalized === 'taken') return normalized
  return normalized
}

function normalizeTickerBlock(value: unknown): string | null {
  const raw = readStringFieldBlock(value).toUpperCase()
  if (!raw) return null
  const normalized = raw.replace(/[^A-Z0-9]/g, '')
  return normalized || null
}

function sanitizeFileNameBlock(fileName: string): string {
  const normalized = fileName.trim()
  if (!normalized) return 'position.md'
  const withoutSlashes = normalized.replace(/[\\/]/g, '-')
  return withoutSlashes.endsWith('.md') ? withoutSlashes : `${withoutSlashes}.md`
}

function sanitizeFileFragmentBlock(value: string): string {
  const normalized = value.trim()
  if (!normalized) return ''
  return normalized.replace(/[^A-Za-z0-9._-]/g, '')
}

function appendFileNameSuffixBlock(fileName: string, suffix: string): string {
  const safeSuffix = sanitizeFileFragmentBlock(suffix)
  const base = removeMdExtensionBlock(fileName)
  return `${base}-${safeSuffix || 'position'}.md`
}

function removeMdExtensionBlock(fileName: string): string {
  return fileName.toLowerCase().endsWith('.md')
    ? fileName.slice(0, -3)
    : fileName
}

function removeFileSchemeBlock(value: string): string {
  if (value.startsWith('file://')) return value.slice('file://'.length)
  return value
}

function normalizeSlashPathBlock(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
}

function trimSlashesBlock(value: string): string {
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

function joinPathBlock(...parts: string[]): string {
  const filtered = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part, index) => (index === 0 ? part.replace(/\/+$/, '') : trimSlashesBlock(part)))
  if (filtered.length === 0) return ''
  return filtered.join('/')
}

async function ensureDirBlock(fs: VaultFS, path: string): Promise<void> {
  try {
    await fs.mkdir(path || '.')
  } catch {
    // Folder may already exist depending on runtime implementation.
  }
}
