import { useCallback, useEffect, useState } from 'react'
import type { AiProvider } from '@/services/orchestrators/chatOrch'
import { runAiAssistOrch, type AiAssistAction, type RunAiAssistResult } from '@/services/orchestrators/aiAssistOrch'
import { resolveAiSelectionOrch } from '@/services/orchestrators/aiSettingsOrch'
import {
  listAiAssistPromptHistoryOrch,
  recordAiAssistPromptHistoryOrch,
  type AiAssistPromptHistoryEntryBlock,
} from '@/services/orchestrators/aiAssistPromptHistoryOrch'
import type { AiSettingsScope } from '@/services/lego_blocks/integrations/aiSettingsBlock'

export interface AiAssistResultPill {
  tone: 'neutral' | 'success' | 'error'
  text: string
}

export interface AiAssistRuntimeBlockState {
  aiSelectionLoading: boolean
  selectedProvider: AiProvider | null
  selectedModel: string | null
  assistRunningAction: AiAssistAction | null
  assistError: string | null
  assistResultPill: AiAssistResultPill | null
  assistSuggestion: RunAiAssistResult | null
  customPromptHistory: AiAssistPromptHistoryEntryBlock[]
  runAssistAction: (action: AiAssistAction, content: string, customPrompt?: string) => Promise<RunAiAssistResult | null>
  applyAssistSuggestion: (onApply: (nextContent: string) => void, overrideContent?: string) => boolean
  dismissAssistSuggestion: () => void
  clearAssistState: () => void
}

export interface UseAiAssistRuntimeBlockOptions {
  scope: AiSettingsScope
  useCase: string
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

export function useAiAssistRuntimeBlock(options: UseAiAssistRuntimeBlockOptions): AiAssistRuntimeBlockState {
  const [aiSelectionLoading, setAiSelectionLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [assistRunningAction, setAssistRunningAction] = useState<AiAssistAction | null>(null)
  const [assistError, setAssistError] = useState<string | null>(null)
  const [assistResultPill, setAssistResultPill] = useState<AiAssistResultPill | null>(null)
  const [assistSuggestion, setAssistSuggestion] = useState<RunAiAssistResult | null>(null)
  const [customPromptHistory, setCustomPromptHistory] = useState<AiAssistPromptHistoryEntryBlock[]>([])

  const syncSelection = useCallback(async () => {
    const selection = await resolveAiSelectionOrch({ scope: options.scope })
    setSelectedProvider(selection?.provider ?? null)
    setSelectedModel(selection?.model ?? null)
    return selection
  }, [options.scope])

  useEffect(() => {
    let cancelled = false
    setAiSelectionLoading(true)
    syncSelection()
      .catch(() => {
        if (cancelled) return
        setSelectedProvider(null)
        setSelectedModel(null)
      })
      .finally(() => {
        if (!cancelled) setAiSelectionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [syncSelection])

  useEffect(() => {
    let cancelled = false
    listAiAssistPromptHistoryOrch(40)
      .then((entries) => {
        if (!cancelled) setCustomPromptHistory(entries)
      })
      .catch((error) => {
        if (cancelled) return
        console.warn('[useAiAssistRuntimeBlock] Failed to load custom prompt history:', error)
        setCustomPromptHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const runAssistAction = useCallback(async (action: AiAssistAction, content: string, customPrompt?: string) => {
    if (assistRunningAction) return null
    const normalizedCustomPrompt = (customPrompt ?? '').trim()
    if (!content.trim()) {
      setAssistError('Add some text before running AI assist.')
      setAssistResultPill({ tone: 'error', text: 'Add some text first' })
      setAssistSuggestion(null)
      return null
    }
    if (action === 'custom' && !normalizedCustomPrompt) {
      setAssistError('Add a prompt before running AI assist.')
      setAssistResultPill({ tone: 'error', text: 'Prompt is required' })
      setAssistSuggestion(null)
      return null
    }

    setAssistRunningAction(action)
    setAssistError(null)
    setAssistResultPill(null)
    setAssistSuggestion(null)

    try {
      if (action === 'custom') {
        try {
          const nextPromptHistory = await recordAiAssistPromptHistoryOrch(normalizedCustomPrompt)
          setCustomPromptHistory(nextPromptHistory.slice(0, 40))
        } catch (historyError) {
          console.warn('[useAiAssistRuntimeBlock] Failed to persist custom prompt history:', historyError)
        }
      }
      const selection = await syncSelection()
      if (!selection) {
        throw new Error('No AI provider available. Configure one in AI Settings.')
      }
      const result = await runAiAssistOrch({
        provider: selection.provider,
        model: selection.model,
        scope: options.scope,
        useCase: options.useCase,
        action,
        content,
        customPrompt: normalizedCustomPrompt,
      })
      if (!result.changed) {
        setAssistError(null)
        setAssistResultPill({ tone: 'neutral', text: `No ${action} changes suggested` })
        return null
      }
      setAssistSuggestion(result)
      setAssistResultPill({ tone: 'success', text: `${action} suggestion ready` })
      return result
    } catch (err) {
      const nextError = errorMessage(err, 'AI assist failed')
      setAssistError(nextError)
      setAssistResultPill({ tone: 'error', text: 'AI assist failed' })
      return null
    } finally {
      setAssistRunningAction(null)
    }
  }, [assistRunningAction, options.scope, options.useCase, syncSelection])

  const applyAssistSuggestion = useCallback((onApply: (nextContent: string) => void, overrideContent?: string): boolean => {
    if (!assistSuggestion) return false
    onApply(overrideContent ?? assistSuggestion.suggestedContent)
    setAssistSuggestion(null)
    setAssistError(null)
    setAssistResultPill({ tone: 'success', text: 'Applied inline' })
    return true
  }, [assistSuggestion])

  const dismissAssistSuggestion = useCallback(() => {
    setAssistSuggestion(null)
  }, [])

  const clearAssistState = useCallback(() => {
    setAssistError(null)
    setAssistSuggestion(null)
    setAssistRunningAction(null)
    setAssistResultPill(null)
  }, [])

  useEffect(() => {
    if (!assistResultPill) return
    const timeoutId = window.setTimeout(() => {
      setAssistResultPill(null)
    }, 3200)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [assistResultPill])

  return {
    aiSelectionLoading,
    selectedProvider,
    selectedModel,
    assistRunningAction,
    assistError,
    assistResultPill,
    assistSuggestion,
    customPromptHistory,
    runAssistAction,
    applyAssistSuggestion,
    dismissAssistSuggestion,
    clearAssistState,
  }
}
