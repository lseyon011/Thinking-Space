import {
  readF9ExecutionOverviewBlock,
  readF9PositionDetailBlock,
  syncF9ExecutionStorageBlock,
  type F9ExecutionOverviewBlock,
  type F9PositionDetailBlock,
  type SyncF9ExecutionResultBlock,
} from '../lego_blocks/integrations/f9ExecutionStorageBlock'
import { readF9ExecutionSettingsOrch } from './f9ExecutionSettingsOrch'
import type { F9OverallSnapshotOrch } from './f9OverallOrch'

export type { F9ExecutionOverviewBlock, F9PositionDetailBlock, SyncF9ExecutionResultBlock }

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

