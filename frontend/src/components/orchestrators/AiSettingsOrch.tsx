import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import AiTelemetryPanelBlock from '@/components/lego_blocks/AiTelemetryPanelBlock'
import { listProvidersOrch, type AiProvider, type AiProviderStatus } from '@/services/orchestrators/chatOrch'
import {
  listAiModelOptionsOrch,
  resolveAiModelForProviderOrch,
  resolveAiSelectionFromProvidersOrch,
  setAiProviderModelOrch,
  setAiSelectedProviderOrch,
} from '@/services/orchestrators/aiSettingsOrch'
import {
  clearAiTelemetryEventsOrch,
  listAiTelemetryEventsOrch,
  type AiTelemetryEvent,
} from '@/services/orchestrators/aiTelemetryOrch'

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

export default function AiSettingsOrch() {
  const [providers, setProviders] = useState<AiProviderStatus[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null)
  const [modelInput, setModelInput] = useState('')
  const [savingModel, setSavingModel] = useState(false)
  const [telemetryEvents, setTelemetryEvents] = useState<AiTelemetryEvent[]>([])
  const [loadingTelemetry, setLoadingTelemetry] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const availableProviders = useMemo(() => providers.filter(item => item.available), [providers])
  const selectedProviderStatus = selectedProvider
    ? providers.find(item => item.provider === selectedProvider) ?? null
    : null
  const selectedKnownModels = selectedProvider ? listAiModelOptionsOrch(selectedProvider) : []

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const items = await listProvidersOrch()
      setProviders(items)
      const selection = resolveAiSelectionFromProvidersOrch(items)
      setSelectedProvider(selection?.provider ?? null)
      setModelInput(selection?.model ?? '')
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load AI providers'))
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  const loadTelemetry = useCallback(() => {
    setLoadingTelemetry(true)
    try {
      setTelemetryEvents(listAiTelemetryEventsOrch(200))
    } finally {
      setLoadingTelemetry(false)
    }
  }, [])

  useEffect(() => {
    void loadProviders()
    loadTelemetry()
  }, [loadProviders, loadTelemetry])

  useEffect(() => {
    const id = window.setInterval(() => {
      loadTelemetry()
    }, 3000)
    return () => {
      window.clearInterval(id)
    }
  }, [loadTelemetry])

  const onProviderChange = (provider: AiProvider) => {
    setAiSelectedProviderOrch(provider)
    setSelectedProvider(provider)
    setModelInput(resolveAiModelForProviderOrch(provider))
    setMessage(`Default provider set to ${provider}.`)
    setError(null)
  }

  const onSaveModel = async () => {
    if (!selectedProvider) return
    const normalized = modelInput.trim()
    if (!normalized) {
      setError('Model cannot be empty.')
      return
    }
    setSavingModel(true)
    try {
      setAiProviderModelOrch(selectedProvider, normalized)
      setModelInput(resolveAiModelForProviderOrch(selectedProvider))
      setMessage(`Default model for ${selectedProvider} updated.`)
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to save model setting'))
    } finally {
      setSavingModel(false)
    }
  }

  const onClearTelemetry = () => {
    clearAiTelemetryEventsOrch()
    setTelemetryEvents([])
  }

  return (
    <div className="space-y-4">
      {(message || error) && (
        <div className="space-y-2">
          {message && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Global AI Defaults</CardTitle>
          <CardDescription>
            These defaults are used by Chat, markdown AI assist, and steward metadata generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingProviders ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Detecting providers...
            </div>
          ) : providers.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
              No providers detected.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Provider
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {providers.map((provider) => (
                    <Button
                      key={provider.provider}
                      size="sm"
                      variant={selectedProvider === provider.provider ? 'default' : 'outline'}
                      disabled={!provider.available}
                      onClick={() => onProviderChange(provider.provider)}
                    >
                      {provider.label}
                      {!provider.available && <span className="ml-1 text-xs opacity-70">unavailable</span>}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Model
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={modelInput}
                    onChange={(event) => setModelInput(event.target.value)}
                    disabled={!selectedProvider || savingModel}
                    placeholder={selectedProviderStatus?.model || 'Select a provider first'}
                    className="min-w-[18rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button size="sm" onClick={() => { void onSaveModel() }} disabled={!selectedProvider || savingModel}>
                    {savingModel ? 'Saving...' : 'Save Model'}
                  </Button>
                </div>
                {selectedKnownModels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    Suggested:
                    {selectedKnownModels.map(model => (
                      <button
                        key={model}
                        type="button"
                        className="rounded-md border border-border/70 px-2 py-0.5 text-foreground hover:bg-muted"
                        onClick={() => setModelInput(model)}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                Available providers: {availableProviders.map(item => item.provider).join(', ') || 'none'}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AiTelemetryPanelBlock
        events={telemetryEvents}
        loading={loadingTelemetry}
        onRefresh={loadTelemetry}
        onClear={onClearTelemetry}
      />
    </div>
  )
}
