import {
  appendAiTelemetryEventBlock,
  clearAiTelemetryEventsBlock,
  listAiTelemetryEventsBlock,
  type AiTelemetryEvent,
  type RecordAiTelemetryInput,
} from '@/services/lego_blocks/integrations/aiTelemetryBlock'

export type { AiTelemetryEvent, RecordAiTelemetryInput }

export function recordAiTelemetryOrch(input: RecordAiTelemetryInput): AiTelemetryEvent {
  return appendAiTelemetryEventBlock(input)
}

export function listAiTelemetryEventsOrch(limit = 100, useCase?: string): AiTelemetryEvent[] {
  const events = listAiTelemetryEventsBlock(limit)
  if (!useCase) return events
  return events.filter(event => event.useCase === useCase)
}

export function clearAiTelemetryEventsOrch(): void {
  clearAiTelemetryEventsBlock()
}
