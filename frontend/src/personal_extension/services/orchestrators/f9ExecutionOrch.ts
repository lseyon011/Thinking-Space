import {
  createF9CompanyBlock,
  createF9ManualPositionBlock,
  readF9OverallCacheBlock,
  readF9ExecutionOverviewBlock,
  readF9PositionDetailBlock,
  saveF9PositionBodyBlock,
  syncF9ExecutionStorageBlock,
  updateF9CompanyOverlayBlock,
  updateF9PositionOverlayBlock,
  type F9CompanyOverviewBlock,
  type F9ExecutionOverviewBlock,
  type F9OverallCacheBlock,
  type F9PositionDetailBlock,
  type F9PositionSummaryBlock,
  type SyncF9ExecutionResultBlock,
} from '../lego_blocks/integrations/f9ExecutionStorageBlock'
import { readF9ExecutionSettingsOrch } from './f9ExecutionSettingsOrch'
import type { F9OverallSnapshotOrch } from './f9OverallOrch'

export type {
  F9CompanyOverviewBlock,
  F9ExecutionOverviewBlock,
  F9OverallCacheBlock,
  F9PositionDetailBlock,
  F9PositionSummaryBlock,
  SyncF9ExecutionResultBlock,
}

async function readConfiguredExecutionFolderPathOrNullOrch(): Promise<string | null> {
  const normalized = (await readF9ExecutionSettingsOrch()).executionFolderPath.trim()
  return normalized || null
}

async function requireConfiguredExecutionFolderPathOrch(): Promise<string> {
  const executionFolderPath = await readConfiguredExecutionFolderPathOrNullOrch()
  if (executionFolderPath) return executionFolderPath
  throw new Error('F9 execution folder path is not configured. Set it in Settings > F9 first.')
}

export async function syncF9ExecutionFromOverallOrch(
  snapshot: F9OverallSnapshotOrch,
): Promise<SyncF9ExecutionResultBlock> {
  const executionFolderPath = await readConfiguredExecutionFolderPathOrNullOrch()
  if (!executionFolderPath) {
    return {
      executionRoot: '',
      overallPath: '',
      companyCount: 0,
      positionCount: 0,
      source: 'none',
      warnings: [],
    }
  }
  return syncF9ExecutionStorageBlock({
    executionFolderPath,
    fetchedAt: snapshot.fetchedAt,
    runtime: snapshot.runtime,
    selectedAccount: snapshot.selectedAccount,
    accountList: snapshot.accountList,
    accountBalanceLegacy: snapshot.accountBalanceLegacy,
    accountPositionsLegacy: snapshot.accountPositionsLegacy,
    assetsPositions: snapshot.assetsPositions,
  })
}

export async function loadF9ExecutionOverviewOrch(): Promise<F9ExecutionOverviewBlock> {
  const executionFolderPath = await readConfiguredExecutionFolderPathOrNullOrch()
  if (!executionFolderPath) {
    return {
      executionRoot: '',
      companyCount: 0,
      positionCount: 0,
      companies: [],
    }
  }
  return readF9ExecutionOverviewBlock(executionFolderPath)
}

export async function loadF9OverallCacheOrch(): Promise<F9OverallCacheBlock | null> {
  const executionFolderPath = await readConfiguredExecutionFolderPathOrNullOrch()
  if (!executionFolderPath) return null
  return readF9OverallCacheBlock(executionFolderPath)
}

export async function loadF9PositionDetailOrch(
  companyTicker: string,
  fileName: string,
): Promise<F9PositionDetailBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return readF9PositionDetailBlock({
    executionFolderPath,
    companyTicker,
    fileName,
  })
}

export async function createF9CompanyOrch(companyTicker: string): Promise<F9CompanyOverviewBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return createF9CompanyBlock({
    executionFolderPath,
    companyTicker,
  })
}

export async function createF9ManualPositionOrch(input: {
  companyTicker: string
  title?: string
  status?: 'taken' | 'planned' | 'watchlist'
  instrumentType?: 'STOCK' | 'OPTION'
  optionType?: 'CALL' | 'PUT' | null
  optionExpireDate?: string | null
  optionExercisePrice?: string | null
  linkedIdeaId?: string | null
  notes?: string
}): Promise<F9PositionSummaryBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return createF9ManualPositionBlock({
    executionFolderPath,
    ...input,
  })
}

export async function updateF9PositionOverlayOrch(input: {
  companyTicker: string
  fileName: string
  status?: 'taken' | 'planned' | 'watchlist'
  linkedIdeaId?: string | null
  title?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical' | null
  description?: string | null
  comments?: Array<{
    text: string
    added_at?: string
    added_by?: string
  }>
  relatedNodes?: string[]
  tags?: string[]
  projectPresetTags?: string[]
}): Promise<F9PositionDetailBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return updateF9PositionOverlayBlock({
    executionFolderPath,
    ...input,
  })
}

export async function updateF9CompanyOverlayOrch(input: {
  companyTicker: string
  strategyNotes?: string | null
  relatedIdeaIds?: string[]
  programGroupId?: string | null
  valuationNotePath?: string | null
  companyPdfReportPath?: string | null
}): Promise<F9CompanyOverviewBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return updateF9CompanyOverlayBlock({
    executionFolderPath,
    ...input,
  })
}

export async function saveF9PositionBodyOrch(input: {
  companyTicker: string
  fileName: string
  body: string
}): Promise<F9PositionDetailBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return saveF9PositionBodyBlock({
    executionFolderPath,
    ...input,
  })
}
