import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAiTelemetryEventsOrch, listAiTelemetryEventsOrch, recordAiTelemetryOrch } from '@/services/orchestrators/aiTelemetryOrch'
import { sendChatWithTelemetryOrch } from '@/services/orchestrators/chatOrch'

const sendChatBlockMock = vi.fn()

vi.mock('@/services/lego_blocks/integrations/aiChatBlock', () => ({
  sendChatBlock: (...args: unknown[]) => sendChatBlockMock(...args),
}))

vi.mock('@/services/lego_blocks/integrations/aiProviderBlock', () => ({
  listProvidersBlock: vi.fn(),
}))

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() { return store.size },
    },
  })
}

describe('aiTelemetryOrch', () => {
  beforeEach(() => {
    installLocalStorageMock()
    localStorage.clear()
    clearAiTelemetryEventsOrch()
    sendChatBlockMock.mockReset()
  })

  it('records and lists telemetry events in descending timestamp order', () => {
    const first = recordAiTelemetryOrch({
      useCase: 'steward.metadata.proposal_generation',
      provider: 'codex-cli',
      model: 'gpt-5.3-codex',
      status: 'success',
      requestedAt: '2026-02-17T20:00:00.000Z',
      respondedAt: '2026-02-17T20:00:01.000Z',
      latencyMs: 1000,
      inputTokens: 20,
      outputTokens: 8,
      totalTokens: 28,
    })
    const second = recordAiTelemetryOrch({
      useCase: 'steward.metadata.proposal_generation',
      provider: 'heuristic',
      model: 'heuristic-v1',
      status: 'success',
      requestedAt: '2026-02-17T21:00:00.000Z',
      respondedAt: '2026-02-17T21:00:00.000Z',
      latencyMs: 0,
    })

    const events = listAiTelemetryEventsOrch(10, 'steward.metadata.proposal_generation')
    expect(events).toHaveLength(2)
    expect(events[0].id).toBe(second.id)
    expect(events[1].id).toBe(first.id)
  })

  it('captures success telemetry from sendChatWithTelemetryOrch', async () => {
    sendChatBlockMock.mockResolvedValue({
      role: 'assistant',
      content: 'ok',
      provider: 'codex-cli',
      model: 'gpt-5.3-codex',
      requested_at: '2026-02-17T20:10:00.000Z',
      responded_at: '2026-02-17T20:10:00.900Z',
      latency_ms: 900,
      input_tokens: 33,
      output_tokens: 7,
      total_tokens: 40,
    })

    const { response, telemetryEvent } = await sendChatWithTelemetryOrch(
      'codex-cli',
      [{ role: 'user', content: 'hello telemetry' }],
      undefined,
      { useCase: 'steward.metadata.proposal_generation', metadata: { filePath: 'notes/a.md' } },
    )

    expect(response.input_tokens).toBe(33)
    expect(response.output_tokens).toBe(7)
    expect(response.total_tokens).toBe(40)
    expect(telemetryEvent.status).toBe('success')
    expect(telemetryEvent.useCase).toBe('steward.metadata.proposal_generation')
    expect(telemetryEvent.provider).toBe('codex-cli')
    expect(telemetryEvent.model).toBe('gpt-5.3-codex')
    expect(telemetryEvent.inputTokens).toBe(33)
    expect(telemetryEvent.outputTokens).toBe(7)
    expect(telemetryEvent.totalTokens).toBe(40)

    const events = listAiTelemetryEventsOrch(10, 'steward.metadata.proposal_generation')
    expect(events[0].id).toBe(telemetryEvent.id)
  })

  it('captures error telemetry from sendChatWithTelemetryOrch', async () => {
    sendChatBlockMock.mockRejectedValue(new Error('network down'))

    await expect(sendChatWithTelemetryOrch(
      'codex-cli',
      [{ role: 'user', content: 'hello telemetry' }],
      undefined,
      { useCase: 'steward.metadata.proposal_generation' },
    )).rejects.toThrow('network down')

    const events = listAiTelemetryEventsOrch(10, 'steward.metadata.proposal_generation')
    expect(events).toHaveLength(1)
    expect(events[0].status).toBe('error')
    expect(events[0].provider).toBe('codex-cli')
    expect(events[0].model).toBe('unknown')
    expect(events[0].errorMessage).toContain('network down')
  })
})
