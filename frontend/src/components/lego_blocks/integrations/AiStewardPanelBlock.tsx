import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import {
  applyStewardMetadataToFileOrch,
  generateStewardMetadataSuggestionForFileOrch,
  type StewardMetadataSuggestion,
} from '@/services/orchestrators/stewardMetadataOrch'
import { getVaultFS } from '@/services/orchestrators/runtimeOrch'
import { cn } from '@/lib/utils'

interface AiStewardPanelBlockProps {
  filePath?: string
  disabled?: boolean
  onApplySuggestion?: (suggestion: StewardMetadataSuggestion) => void | Promise<void>
  className?: string
  showMissingFileMessage?: boolean
}

interface PurposeProposalState {
  suggestion: StewardMetadataSuggestion
  generatedAt: string
}

export default function AiStewardPanelBlock({
  filePath,
  disabled = false,
  onApplySuggestion,
  className,
  showMissingFileMessage = true,
}: AiStewardPanelBlockProps) {
  const resolvedFilePath = (filePath ?? '').trim()
  const [fileCheckLoading, setFileCheckLoading] = useState(false)
  const [fileAvailable, setFileAvailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [proposal, setProposal] = useState<PurposeProposalState | null>(null)

  useEffect(() => {
    if (!resolvedFilePath) {
      setFileCheckLoading(false)
      setFileAvailable(false)
      return
    }

    let cancelled = false
    setFileCheckLoading(true)
    void (async () => {
      try {
        const fs = getVaultFS()
        const exists = await fs.exists(resolvedFilePath)
        if (cancelled) return
        setFileAvailable(Boolean(exists))
      } catch {
        if (cancelled) return
        setFileAvailable(false)
      } finally {
        if (!cancelled) setFileCheckLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resolvedFilePath])

  useEffect(() => {
    setLoading(false)
    setError(null)
    setMessage(null)
    setProposal(null)
  }, [resolvedFilePath, fileAvailable])

  const generateProposal = useCallback(async () => {
    if (!resolvedFilePath || !fileAvailable) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const suggestion = await generateStewardMetadataSuggestionForFileOrch(resolvedFilePath)
      setProposal({
        suggestion,
        generatedAt: new Date().toISOString(),
      })
      const source = suggestion.usedAi
        ? `AI (${suggestion.provider}${suggestion.model ? `/${suggestion.model}` : ''})`
        : 'heuristics'
      setMessage(`Generated purpose proposal from ${source}. Review and accept or reject.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate steward metadata')
    } finally {
      setLoading(false)
    }
  }, [fileAvailable, resolvedFilePath])

  const acceptProposal = useCallback(async () => {
    if (!proposal) return
    try {
      if (onApplySuggestion) {
        await onApplySuggestion(proposal.suggestion)
      } else if (resolvedFilePath && fileAvailable) {
        await applyStewardMetadataToFileOrch({
          filePath: resolvedFilePath,
          summary: proposal.suggestion.summary,
          tags: proposal.suggestion.tags,
          suggestedEpicKey: proposal.suggestion.suggestedEpicKey,
          suggestedIdeaKey: proposal.suggestion.suggestedIdeaKey,
        })
      } else {
        throw new Error('Cannot apply steward proposal without a saved file.')
      }
      setProposal(null)
      setError(null)
      setMessage('Applied purpose proposal.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply purpose proposal')
    }
  }, [fileAvailable, onApplySuggestion, proposal, resolvedFilePath])

  const dismissProposal = useCallback(() => {
    if (!proposal) return
    setProposal(null)
    setError(null)
    setMessage(onApplySuggestion ? 'Rejected purpose proposal.' : 'Dismissed purpose proposal.')
  }, [onApplySuggestion, proposal])

  if (!resolvedFilePath || (!fileCheckLoading && !fileAvailable)) {
    if (!showMissingFileMessage) return null
    return (
      <div className={cn('rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground', className)}>
        AI Steward is hidden for raw content. Save or open an existing file path to enable steward proposals.
      </div>
    )
  }

  if (fileCheckLoading) {
    return (
      <div className={cn('rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground', className)}>
        Checking file context for AI Steward...
      </div>
    )
  }

  return (
    <div className={cn('space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { void generateProposal() }}
          disabled={disabled || loading}
          className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          title="Generate steward purpose metadata for this file"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? 'Generating...' : 'Purpose for This File'}
        </button>
        <span className="text-xs text-muted-foreground">
          Uses steward metadata generation to create a proposal.
        </span>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {proposal && (
        <div className="space-y-2 rounded-lg border border-border/70 bg-background px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Purpose Proposal
            </div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(proposal.generatedAt).toLocaleString()}
            </div>
          </div>

          <p className="text-xs text-foreground">{proposal.suggestion.summary}</p>

          {(proposal.suggestion.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {proposal.suggestion.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            Suggested epic: {proposal.suggestion.suggestedEpicKey || 'none'} | Suggested idea: {proposal.suggestion.suggestedIdeaKey || 'none'}
          </div>

          <div className="text-[11px] text-muted-foreground">
            {proposal.suggestion.rationale}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void acceptProposal() }}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-95"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={dismissProposal}
              className="rounded-md border border-border/70 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
