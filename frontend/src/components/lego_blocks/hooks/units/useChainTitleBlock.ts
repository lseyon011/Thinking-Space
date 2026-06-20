// Hook that resolves a chain to a short AI-generated title when one is
// available, falling back to chain.topic (the first user message) when no
// local LLM is running, no cache hit exists yet, or generation fails.
//
// Behavior:
// - Read sidecar JSON first (cheap IPC + in-memory mirror).
// - If cache valid (msgCount + endedIso match), return cached title.
// - If cache miss AND local server is reachable, enqueue a generation; the
//   queue caps concurrency so opening a busy day doesn't fire 30 parallel
//   inference calls.
// - The hook never throws; on any error it returns the fallback.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityChain } from '@/services/lego_blocks/units/aiActivityParserBlock'
import {
  readSessionTitleBlock,
  sessionTitleAvailableBlock,
  writeSessionTitleBlock,
  type SessionTitleRecord,
} from '@/services/lego_blocks/units/sessionTitleStoreBlock'
import {
  generateChainTitleBlock,
  probeLocalLlmAvailabilityBlock,
  TITLE_PROMPT_VERSION,
} from '@/services/lego_blocks/integrations/sessionTitleGenBlock'

export interface ChainTitleState {
  /** What to render — always non-empty. Either the AI title or chain.topic. */
  display: string
  /** Did the title come from the local LLM (vs the chain's first message). */
  isAi: boolean
  /** True while generation is running for this chain. */
  loading: boolean
}

function cacheKeyForChain(chain: ActivityChain): string | null {
  // First session's sessionId is stable across chain regrouping; if absent
  // we can't cache safely, so disable the feature for this chain.
  const first = chain.sessions[0]
  if (!first?.sessionId) return null
  return first.sessionId
}

function isCacheFresh(record: SessionTitleRecord, chain: ActivityChain): boolean {
  // Regenerate when the prompt revision moves forward (different generation
  // strategy → stale title), or when the session has grown since the title
  // was last generated.
  if ((record.promptVersion ?? 0) < TITLE_PROMPT_VERSION) return false
  if (record.msgCount > 0 && record.msgCount < chain.msgCount) return false
  return true
}

// Simple global FIFO queue with concurrency cap, shared across all hook
// instances so opening a day with 20 rows doesn't melt the local server.
const MAX_CONCURRENT = 2
let inFlight = 0
const queue: Array<() => Promise<void>> = []

function enqueue(task: () => Promise<void>): void {
  queue.push(task)
  pump()
}

function pump(): void {
  while (inFlight < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!
    inFlight += 1
    next()
      .catch(() => undefined)
      .finally(() => {
        inFlight -= 1
        pump()
      })
  }
}

export function useChainTitleBlock(chain: ActivityChain): ChainTitleState {
  const fallback = chain.topic
  const [aiTitle, setAiTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const cancelledRef = useRef(false)
  const key = useMemo(() => cacheKeyForChain(chain), [chain])

  useEffect(() => {
    cancelledRef.current = false
    setAiTitle(null)
    if (!key) return
    if (!sessionTitleAvailableBlock()) return

    let alive = true
    void (async () => {
      const record = await readSessionTitleBlock(key)
      if (!alive) return
      if (record && isCacheFresh(record, chain)) {
        setAiTitle(record.title)
        return
      }
      // Cache miss or stale — kick off generation if the server is up.
      const availability = await probeLocalLlmAvailabilityBlock()
      if (!alive) return
      if (!availability.available) return

      setLoading(true)
      enqueue(async () => {
        if (cancelledRef.current) return
        const generated = await generateChainTitleBlock(chain)
        if (cancelledRef.current) return
        if (!generated) {
          setLoading(false)
          return
        }
        const persisted: SessionTitleRecord = {
          sessionId: key,
          title: generated.title,
          model: generated.model,
          generatedAt: new Date().toISOString(),
          sourceMtimeMs: (chain.sessions[0]?.mtime ?? 0) * 1000,
          msgCount: chain.msgCount,
          promptVersion: TITLE_PROMPT_VERSION,
        }
        await writeSessionTitleBlock(persisted)
        if (cancelledRef.current) return
        setAiTitle(persisted.title)
        setLoading(false)
      })
    })()

    return () => {
      alive = false
      cancelledRef.current = true
    }
    // chain identity is stable per render via chain.key; depend on the cache
    // key + msgCount so a growing session triggers a fresh resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, chain.msgCount])

  return {
    display: aiTitle || fallback,
    isAi: !!aiTitle,
    loading,
  }
}
