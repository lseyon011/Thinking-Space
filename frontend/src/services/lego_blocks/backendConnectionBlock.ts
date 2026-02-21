export interface BackendConnectionProbeResult {
  connected: boolean
  healthStatus?: string
  rootEntryCount?: number
  error?: string
}

async function readErrorDetail(response: Response): Promise<string> {
  let raw = ''
  try {
    if (typeof response.text === 'function') {
      raw = await response.text()
    }
  } catch {
    raw = ''
  }

  if (raw.trim()) {
    try {
      const payload = JSON.parse(raw) as { detail?: unknown }
      if (typeof payload.detail === 'string' && payload.detail.trim()) {
        return payload.detail.trim()
      }
    } catch {
      // Fall through to sanitized text.
    }

    const sanitized = raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (sanitized) {
      return sanitized.slice(0, 260)
    }
  }
  return response.statusText || `HTTP ${response.status}`
}

export async function probeBackendConnectionBlock(forceRefresh = false): Promise<BackendConnectionProbeResult> {
  const requestInit: RequestInit | undefined = forceRefresh ? { cache: 'no-store' } : undefined

  try {
    const healthResponse = await fetch('/health', requestInit)
    // In web dev, Vite proxies /api/* only, so /health may 404 even while backend is up.
    // Treat 404 as non-fatal and rely on vault endpoint probe for definitive connectivity.
    const healthNotFound = healthResponse.status === 404
    if (!healthResponse.ok && !healthNotFound) {
      return {
        connected: false,
        error: `Backend health check failed (${await readErrorDetail(healthResponse)})`,
      }
    }

    let healthStatus: string | undefined
    try {
      const healthPayload = await healthResponse.json() as { status?: unknown }
      if (typeof healthPayload.status === 'string') {
        healthStatus = healthPayload.status.trim() || undefined
      }
    } catch {
      // Health payload is optional for UI status.
    }

    const readdirResponse = await fetch('/api/tools/vault/readdir?path=', requestInit)
    if (!readdirResponse.ok) {
      const detail = await readErrorDetail(readdirResponse)
      const readdirProxyFailureHint = (
        healthNotFound
        && readdirResponse.status === 500
        && detail.toLowerCase() === 'internal server error'
      )
      return {
        connected: false,
        healthStatus,
        error: readdirProxyFailureHint
          ? 'Vault access check failed (Internal Server Error: backend may be offline or unreachable at http://localhost:8000)'
          : `Vault access check failed (${detail})`,
      }
    }

    const readdirPayload = await readdirResponse.json() as {
      count?: unknown
      entries?: unknown
    }
    const rootEntryCount = typeof readdirPayload.count === 'number'
      ? readdirPayload.count
      : (Array.isArray(readdirPayload.entries) ? readdirPayload.entries.length : undefined)

    return {
      connected: true,
      healthStatus,
      rootEntryCount,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      connected: false,
      error: `Backend connection failed (${message})`,
    }
  }
}
