import {
  createF9CompanyBlock,
  createF9ManualPositionBlock,
  readF9OverallCacheBlock,
  readF9ExecutionOverviewBlock,
  readF9PositionDetailBlock,
  saveF9PositionBodyBlock,
  syncF9ExecutionStorageBlock,
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

export async function syncF9ExecutionFromOverallOrch(
  snapshot: F9OverallSnapshotOrch,
): Promise<SyncF9ExecutionResultBlock> {
  const settings = readF9ExecutionSettingsOrch()
  return syncF9ExecutionStorageBlock({
    executionFolderPath: settings.executionFolderPath,
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
  const settings = readF9ExecutionSettingsOrch()
  return readF9ExecutionOverviewBlock(settings.executionFolderPath)
}

export async function loadF9OverallCacheOrch(): Promise<F9OverallCacheBlock | null> {
  const settings = readF9ExecutionSettingsOrch()
  return readF9OverallCacheBlock(settings.executionFolderPath)
}

export async function loadF9PositionDetailOrch(
  companyTicker: string,
  fileName: string,
): Promise<F9PositionDetailBlock> {
  const settings = readF9ExecutionSettingsOrch()
  return readF9PositionDetailBlock({
    executionFolderPath: settings.executionFolderPath,
    companyTicker,
    fileName,
  })
}

export async function createF9CompanyOrch(companyTicker: string): Promise<F9CompanyOverviewBlock> {
  const settings = readF9ExecutionSettingsOrch()
  return createF9CompanyBlock({
    executionFolderPath: settings.executionFolderPath,
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
  const settings = readF9ExecutionSettingsOrch()
  return createF9ManualPositionBlock({
    executionFolderPath: settings.executionFolderPath,
    ...input,
  })
}

export async function updateF9PositionOverlayOrch(input: {
  companyTicker: string
  fileName: string
  status?: 'taken' | 'planned' | 'watchlist'
  linkedIdeaId?: string | null
}): Promise<F9PositionDetailBlock> {
  const settings = readF9ExecutionSettingsOrch()
  return updateF9PositionOverlayBlock({
    executionFolderPath: settings.executionFolderPath,
    ...input,
  })
}

export async function saveF9PositionBodyOrch(input: {
  companyTicker: string
  fileName: string
  body: string
}): Promise<F9PositionDetailBlock> {
  const settings = readF9ExecutionSettingsOrch()
  return saveF9PositionBodyBlock({
    executionFolderPath: settings.executionFolderPath,
    ...input,
  })
}
