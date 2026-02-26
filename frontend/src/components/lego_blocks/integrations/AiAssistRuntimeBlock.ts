import { useCallback, useEffect, useState } from 'react'
import type { AiProvider } from '@/services/orchestrators/chatOrch'
import { runAiAssistOrch, type AiAssistAction, type RunAiAssistResult } from '@/services/orchestrators/aiAssistOrch'
import { resolveAiSelectionOrch } from '@/services/orchestrators/aiSettingsOrch'
import type { AiSettingsScope } from '@/services/lego_blocks/integrations/aiSettingsBlock'

export interface AiAssistRuntimeBlockState {
  aiSelectionLoading: boolean
  selectedProvider: AiProvider | null
  selectedModel: string | null
  assistRunningAction: AiAssistAction | null
  assistError: string | null
  assistSuggestion: RunAiAssistResult | null
  runAssistAction: (action: AiAssistAction, content: string) => Promise<RunAiAssistResult | null>
  applyAssistSuggestion: (onApply: (nextContent: string) => void) => boolean
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
  const [assistSuggestion, setAssistSuggestion] = useState<RunAiAssistResult | null>(null)

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

  const runAssistAction = useCallback(async (action: AiAssistAction, content: string) => {
    if (assistRunningAction) return null
    if (!content.trim()) {
      setAssistError('Add some text before running AI assist.')
      setAssistSuggestion(null)
      return null
    }

    setAssistRunningAction(action)
    setAssistError(null)
    setAssistSuggestion(null)

    try {
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
      })
      if (!result.changed) {
        setAssistError(`No ${action} changes suggested.`)
        return null
      }
      setAssistSuggestion(result)
      return result
    } catch (err) {
      setAssistError(errorMessage(err, 'AI assist failed'))
      return null
    } finally {
      setAssistRunningAction(null)
    }
  }, [assistRunningAction, options.scope, options.useCase, syncSelection])

  const applyAssistSuggestion = useCallback((onApply: (nextContent: string) => void): boolean => {
    if (!assistSuggestion) return false
    onApply(assistSuggestion.suggestedContent)
    setAssistSuggestion(null)
    setAssistError(null)
    return true
  }, [assistSuggestion])

  const dismissAssistSuggestion = useCallback(() => {
    setAssistSuggestion(null)
  }, [])

  const clearAssistState = useCallback(() => {
    setAssistError(null)
    setAssistSuggestion(null)
    setAssistRunningAction(null)
  }, [])

  return {
    aiSelectionLoading,
    selectedProvider,
    selectedModel,
    assistRunningAction,
    assistError,
    assistSuggestion,
    runAssistAction,
    applyAssistSuggestion,
    dismissAssistSuggestion,
    clearAssistState,
  }
}
