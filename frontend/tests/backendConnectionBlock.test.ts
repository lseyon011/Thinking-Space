import { describe, expect, it, vi } from 'vitest'

describe('backendConnectionBlock', () => {
  it('reports connected when health and vault checks succeed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 12 }),
      })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { probeBackendConnectionBlock } = await import('@/services/lego_blocks/backendConnectionBlock')
    const result = await probeBackendConnectionBlock(true)

    expect(result.connected).toBe(true)
    expect(result.healthStatus).toBe('healthy')
    expect(result.rootEntryCount).toBe(12)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/health', { cache: 'no-store' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/tools/vault/readdir?path=', { cache: 'no-store' })
  })

  it('returns error when health endpoint fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ detail: 'backend down' }),
    })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { probeBackendConnectionBlock } = await import('@/services/lego_blocks/backendConnectionBlock')
    const result = await probeBackendConnectionBlock(true)

    expect(result.connected).toBe(false)
    expect(result.error).toContain('Backend health check failed')
  })

  it('continues when health endpoint is not found but vault check succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'not found' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 3 }),
      })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { probeBackendConnectionBlock } = await import('@/services/lego_blocks/backendConnectionBlock')
    const result = await probeBackendConnectionBlock(true)

    expect(result.connected).toBe(true)
    expect(result.healthStatus).toBeUndefined()
    expect(result.rootEntryCount).toBe(3)
  })

  it('returns error when vault readdir check fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'vault missing' }),
      })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { probeBackendConnectionBlock } = await import('@/services/lego_blocks/backendConnectionBlock')
    const result = await probeBackendConnectionBlock(true)

    expect(result.connected).toBe(false)
    expect(result.error).toContain('Vault access check failed')
  })

  it('adds backend offline hint for proxy-style readdir internal server errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'not found' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Internal Server Error',
      })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { probeBackendConnectionBlock } = await import('@/services/lego_blocks/backendConnectionBlock')
    const result = await probeBackendConnectionBlock(true)

    expect(result.connected).toBe(false)
    expect(result.error).toContain('backend may be offline or unreachable at http://localhost:8000')
  })
})
