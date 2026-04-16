import {
  createWebullCompanyBlock,
  createWebullManualPositionBlock,
  readWebullOverallCacheBlock,
  readWebullExecutionOverviewBlock,
  readWebullPositionDetailBlock,
  saveWebullPositionBodyBlock,
  syncWebullExecutionStorageBlock,
  updateWebullCompanyOverlayBlock,
  updateWebullPositionOverlayBlock,
  type WebullCompanyOverviewBlock,
  type WebullExecutionOverviewBlock,
  type WebullOverallCacheBlock,
  type WebullPositionDetailBlock,
  type WebullPositionSummaryBlock,
  type SyncWebullExecutionResultBlock,
} from '../lego_blocks/integrations/webullExecutionStorageBlock'
import { readWebullExecutionSettingsOrch } from './webullExecutionSettingsOrch'
import type { WebullOverallSnapshotOrch } from './webullOverallOrch'

export type {
  WebullCompanyOverviewBlock,
  WebullExecutionOverviewBlock,
  WebullOverallCacheBlock,
  WebullPositionDetailBlock,
  WebullPositionSummaryBlock,
  SyncWebullExecutionResultBlock,
}

async function readConfiguredExecutionFolderPathOrNullOrch(): Promise<string | null> {
  const normalized = (await readWebullExecutionSettingsOrch()).executionFolderPath.trim()
  return normalized || null
}

async function requireConfiguredExecutionFolderPathOrch(): Promise<string> {
  const executionFolderPath = await readConfiguredExecutionFolderPathOrNullOrch()
  if (executionFolderPath) return executionFolderPath
  throw new Error('Webull execution folder path is not configured. Set it in Settings > Webull first.')
}

export async function syncWebullExecutionFromOverallOrch(
  snapshot: WebullOverallSnapshotOrch,
): Promise<SyncWebullExecutionResultBlock> {
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
  return syncWebullExecutionStorageBlock({
    executionFolderPath,
    fetchedAt: snapshot.fetchedAt,
    runtime: snapshot.runtime,
    selectedAccount: snapshot.selectedAccount,
    accounts: snapshot.accounts,
    accountList: snapshot.accountList,
    accountBalanceLegacy: snapshot.accountBalanceLegacy,
    accountPositionsLegacy: snapshot.accountPositionsLegacy,
    assetsPositions: snapshot.assetsPositions,
  })
}

export async function loadWebullExecutionOverviewOrch(): Promise<WebullExecutionOverviewBlock> {
  const executionFolderPath = await readConfiguredExecutionFolderPathOrNullOrch()
  if (!executionFolderPath) {
    return {
      executionRoot: '',
      companyCount: 0,
      positionCount: 0,
      companies: [],
    }
  }
  return readWebullExecutionOverviewBlock(executionFolderPath)
}

export async function loadWebullOverallCacheOrch(): Promise<WebullOverallCacheBlock | null> {
  const executionFolderPath = await readConfiguredExecutionFolderPathOrNullOrch()
  if (!executionFolderPath) return null
  return readWebullOverallCacheBlock(executionFolderPath)
}

export async function loadWebullPositionDetailOrch(
  companyTicker: string,
  fileName: string,
): Promise<WebullPositionDetailBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return readWebullPositionDetailBlock({
    executionFolderPath,
    companyTicker,
    fileName,
  })
}

export async function createWebullCompanyOrch(companyTicker: string): Promise<WebullCompanyOverviewBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return createWebullCompanyBlock({
    executionFolderPath,
    companyTicker,
  })
}

export async function createWebullManualPositionOrch(input: {
  companyTicker: string
  title?: string
  status?: 'taken' | 'planned' | 'watchlist'
  instrumentType?: 'STOCK' | 'OPTION'
  optionType?: 'CALL' | 'PUT' | null
  optionExpireDate?: string | null
  optionExercisePrice?: string | null
  linkedIdeaId?: string | null
  notes?: string
}): Promise<WebullPositionSummaryBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return createWebullManualPositionBlock({
    executionFolderPath,
    ...input,
  })
}

export async function updateWebullPositionOverlayOrch(input: {
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
}): Promise<WebullPositionDetailBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return updateWebullPositionOverlayBlock({
    executionFolderPath,
    ...input,
  })
}

export async function updateWebullCompanyOverlayOrch(input: {
  companyTicker: string
  strategyNotes?: string | null
  relatedIdeaIds?: string[]
  programGroupId?: string | null
  valuationNotePath?: string | null
  companyPdfReportPath?: string | null
}): Promise<WebullCompanyOverviewBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return updateWebullCompanyOverlayBlock({
    executionFolderPath,
    ...input,
  })
}

export async function saveWebullPositionBodyOrch(input: {
  companyTicker: string
  fileName: string
  body: string
}): Promise<WebullPositionDetailBlock> {
  const executionFolderPath = await requireConfiguredExecutionFolderPathOrch()
  return saveWebullPositionBodyBlock({
    executionFolderPath,
    ...input,
  })
}
