import {
  getDefaultSchedulerSettingsBlock,
  getNextScheduledTaskRunAtBlock,
  getPreviousScheduledTaskRunAtBlock,
  getScheduledTaskIntervalMsBlock,
  readScheduledTaskLastAttemptByIdBlock,
  readSchedulerSettingsBlock,
  sanitizeScheduledTaskBlock,
  sanitizeSchedulerSettingsBlock,
  SCHEDULED_TASK_ACTION_OPTIONS_BLOCK,
  writeScheduledTaskLastAttemptAtBlock,
  writeSchedulerSettingsBlock,
  type SchedulerSettingsBlock,
  type ScheduledTaskActionBlock,
  type ScheduledTaskBlock,
} from '@/services/lego_blocks/integrations/schedulerSettingsBlock'

export type {
  SchedulerSettingsBlock,
  ScheduledTaskActionBlock,
  ScheduledTaskBlock,
}

export { SCHEDULED_TASK_ACTION_OPTIONS_BLOCK }

export function getDefaultSchedulerSettingsOrch(): SchedulerSettingsBlock {
  return getDefaultSchedulerSettingsBlock()
}

export function sanitizeSchedulerSettingsOrch(
  value: Partial<SchedulerSettingsBlock> | null | undefined,
): SchedulerSettingsBlock {
  return sanitizeSchedulerSettingsBlock(value)
}

export function sanitizeScheduledTaskOrch(
  value: Partial<ScheduledTaskBlock> | null | undefined,
): ScheduledTaskBlock | null {
  return sanitizeScheduledTaskBlock(value)
}

export function readSchedulerSettingsOrch(): SchedulerSettingsBlock {
  return readSchedulerSettingsBlock()
}

export function writeSchedulerSettingsOrch(settings: SchedulerSettingsBlock): SchedulerSettingsBlock {
  return writeSchedulerSettingsBlock(settings)
}

export function readScheduledTaskLastAttemptByIdOrch(): Record<string, number> {
  return readScheduledTaskLastAttemptByIdBlock()
}

export function writeScheduledTaskLastAttemptAtOrch(taskId: string, timestampMs: number): Record<string, number> {
  return writeScheduledTaskLastAttemptAtBlock(taskId, timestampMs)
}

export function getScheduledTaskIntervalMsOrch(task: ScheduledTaskBlock): number {
  return getScheduledTaskIntervalMsBlock(task)
}

export function getPreviousScheduledTaskRunAtOrch(task: ScheduledTaskBlock, nowMs = Date.now()): number | null {
  return getPreviousScheduledTaskRunAtBlock(task, nowMs)
}

export function getNextScheduledTaskRunAtOrch(task: ScheduledTaskBlock, nowMs = Date.now()): number | null {
  return getNextScheduledTaskRunAtBlock(task, nowMs)
}
