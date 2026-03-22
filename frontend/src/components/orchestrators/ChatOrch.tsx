import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Send, AlertCircle, PanelLeftClose } from 'lucide-react'
import { useExpandedSetBlock } from '@/components/lego_blocks/hooks/shared/useExpandedSetBlock'
import SidebarGroupHeaderBlock from '@/components/lego_blocks/units/ui/SidebarGroupHeaderBlock'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent } from '@/components/lego_blocks/units/ui/card'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import UrlDocumentBlock from '@/components/lego_blocks/integrations/UrlDocumentBlock'
import { cn } from '@/lib/utils'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import { useIosSidebarSwipeBlock } from '@/components/lego_blocks/hooks/shared/useIosSidebarSwipeBlock'
import {
  type AiProvider,
  type AiProviderStatus,
  type ChatMessage,
  type ChatResponse,
  listProvidersOrch,
  sendChatWithTelemetryOrch,
} from '@/services/orchestrators/chatOrch'
import {
  resolveAiThinkingForScopeProviderOrch,
  resolveAiSelectionFromProvidersOrch,
  resolveAiSelectionOrch,
  setAiScopeProviderThinkingOrch,
  setAiSelectedProviderOrch,
} from '@/services/orchestrators/aiSettingsOrch'
import { readAiWebsitesOrch } from '@/services/orchestrators/aiWebsiteOrch'
import type { AiWebsiteBlock } from '@/services/lego_blocks/units/aiWebsiteBlock'
import {
  CHAT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK,
  CHAT_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK,
  dispatchChatSidebarChromeStateBlock,
} from '@/services/lego_blocks/units/chatSidebarChromeBlock'
import CodexUsageDashboardOrch from '@/components/orchestrators/CodexUsageDashboardOrch'

const USAGE_DASHBOARD_SITE_ID_BLOCK = '__usage_dashboard__'

interface ChatTimelineMessage extends ChatMessage {
  id: string
  provider?: AiProvider
  model?: string
  requested_at?: string
  responded_at?: string
  latency_ms?: number
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  thread_id?: string
}

function formatTimestamp(value?: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString()
}

interface ChatOrchProps {
  active?: boolean
}

export default function ChatOrch({ active = true }: ChatOrchProps) {
  const { layout } = useUILayoutBlock()
  const isIos = layout.surface === 'capacitor-ios'
  const isIosPhone = isIos && layout.mode === 'phone'
  const [providers, setProviders] = useState<AiProviderStatus[]>([])
  const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [thinkEnabled, setThinkEnabled] = useState(true)
  const [messages, setMessages] = useState<ChatTimelineMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)
  const [aiWebsites, setAiWebsites] = useState<AiWebsiteBlock[]>([])
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [webviewHeaderVisible, setWebviewHeaderVisible] = useState(true)
  // Sections start expanded by default (both IDs pre-seeded)
  const { isExpanded: isSectionExpanded, toggle: toggleSection } = useExpandedSetBlock(
    'ltm-chat-expanded-sections',
    ['tools', 'api', 'web'],
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const latestCodexCliThreadId = (): string | undefined => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i]
      if (msg.provider === 'codex-cli' && typeof msg.thread_id === 'string' && msg.thread_id.trim()) {
        return msg.thread_id.trim()
      }
    }
    return undefined
  }

  useEffect(() => {
    void readAiWebsitesOrch().then(setAiWebsites)
    listProvidersOrch()
      .then((p) => {
        setProviders(p)
        const selection = resolveAiSelectionFromProvidersOrch(p, { scope: 'chat' })
        setSelectedProvider(selection?.provider ?? null)
        setSelectedModel(selection?.model ?? null)
        setThinkEnabled(
          selection?.provider === 'opensource-ai'
            ? resolveAiThinkingForScopeProviderOrch('chat', 'opensource-ai')
            : true,
        )
      })
      .catch((err) => setError(err.message))
      .finally(() => setProvidersLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedProvider) {
      setSelectedModel(null)
      return
    }
    const selection = resolveAiSelectionFromProvidersOrch(providers, { provider: selectedProvider, scope: 'chat' })
    setSelectedProvider(selection?.provider ?? null)
    setSelectedModel(selection?.model ?? null)
    setThinkEnabled(
      selection?.provider === 'opensource-ai'
        ? resolveAiThinkingForScopeProviderOrch('chat', 'opensource-ai')
        : true,
    )
  }, [providers, selectedProvider])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const dashboardSelected = selectedWebsiteId === USAGE_DASHBOARD_SITE_ID_BLOCK
  const selectedWebsiteForChrome = dashboardSelected
    ? null
    : aiWebsites.find(s => s.id === selectedWebsiteId) ?? null

  // Sync chrome state into the top chrome
  useEffect(() => {
    if (!active) return

    const websiteName = dashboardSelected ? 'Usage Dashboard' : selectedWebsiteForChrome?.name
    const providerLabel = selectedProvider
      ? providers.find(p => p.provider === selectedProvider)?.label ?? selectedProvider
      : null
    const suffix = websiteName ?? providerLabel
    const label = suffix ? `AI · ${suffix}` : 'AI'

    dispatchChatSidebarChromeStateBlock({
      enabled: true,
      collapsed: sidebarCollapsed,
      headerVisible: webviewHeaderVisible,
      showHeaderToggle: selectedWebsiteForChrome !== null,
      label,
    })
  }, [active, dashboardSelected, selectedWebsiteForChrome, sidebarCollapsed, webviewHeaderVisible, selectedProvider, providers])

  useEffect(() => {
    if (!active) return
    const handler = () => setSidebarCollapsed(prev => !prev)
    window.addEventListener(CHAT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
    return () => window.removeEventListener(CHAT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
  }, [active])

  useEffect(() => {
    if (!active) return
    const handler = () => setWebviewHeaderVisible(prev => !prev)
    window.addEventListener(CHAT_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK, handler)
    return () => window.removeEventListener(CHAT_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK, handler)
  }, [active])

  const handleToggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])
  useIosSidebarSwipeBlock({
    isIos: isIos && active,
    isOpen: active && !sidebarCollapsed,
    keyboardVisible: layout.keyboardVisible,
    onToggle: handleToggleSidebar,
  })

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !selectedProvider || loading) return

    const userMsg: ChatTimelineMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      requested_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const allMessages = [...messages, userMsg]
      const selection = await resolveAiSelectionOrch({ provider: selectedProvider, scope: 'chat' })
      if (!selection) {
        throw new Error('No AI provider available. Configure one in AI Settings.')
      }
      setSelectedModel(selection.model)
      const resolvedThinkEnabled = selection.provider === 'opensource-ai'
        ? resolveAiThinkingForScopeProviderOrch('chat', 'opensource-ai')
        : true
      setThinkEnabled(resolvedThinkEnabled)
      const { response } = await sendChatWithTelemetryOrch(
        selection.provider,
        allMessages,
        {
          model: selection.model,
          opensourceAi: selection.provider === 'opensource-ai'
            ? { think: resolvedThinkEnabled }
            : undefined,
          threadId: selection.provider === 'codex-cli'
            ? latestCodexCliThreadId()
            : undefined,
        },
        {
          useCase: 'chat.session',
          metadata: {
            messageCount: allMessages.length,
          },
        },
      )
      const timelineResponse: ChatResponse = response
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: timelineResponse.content,
        provider: timelineResponse.provider,
        model: timelineResponse.model,
        requested_at: timelineResponse.requested_at,
        responded_at: timelineResponse.responded_at,
        latency_ms: timelineResponse.latency_ms,
        input_tokens: timelineResponse.input_tokens,
        output_tokens: timelineResponse.output_tokens,
        total_tokens: timelineResponse.total_tokens,
        thread_id: timelineResponse.thread_id,
      }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response')
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      {isIosPhone && !sidebarCollapsed && (
        <div
          className="ltm-phone-sidebar-backdrop"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'flex shrink-0 flex-col overflow-hidden',
          isIosPhone
            ? cn(
              'ltm-phone-sidebar-sheet transition-transform duration-200 ease-out',
              sidebarCollapsed ? '-translate-x-[calc(100%+1rem)]' : 'translate-x-0',
            )
            : cn(
              'border-r border-border/50 transition-[width,opacity] duration-200 ease-out',
              sidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-48 opacity-100',
            ),
        )}
        aria-hidden={sidebarCollapsed}
      >
        <div className="ltm-shell-segment-header flex h-11 shrink-0 items-center justify-between px-2">
          <span className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AI
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Collapse sidebar"
            onClick={() => setSidebarCollapsed(true)}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {providersLoading ? (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Detecting...
            </div>
          ) : (
            <>
              {/* API providers */}
              <div>
                <SidebarGroupHeaderBlock
                  name="Tools"
                  expanded={isSectionExpanded('tools')}
                  onToggle={() => toggleSection('tools')}
                  badge={1}
                />
                {isSectionExpanded('tools') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWebsiteId(USAGE_DASHBOARD_SITE_ID_BLOCK)
                      setSelectedProvider(null)
                    }}
                    className={cn(
                      'flex w-full items-center border-b border-border/40 px-3 py-2.5 text-left text-xs transition-colors',
                      dashboardSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted/40',
                    )}
                    style={{ paddingLeft: '24px' }}
                  >
                    <span className="truncate">Usage Dashboard</span>
                  </button>
                )}
              </div>

              {/* API providers */}
              {providers.length > 0 && (
                <div>
                  <SidebarGroupHeaderBlock
                    name="API"
                    expanded={isSectionExpanded('api')}
                    onToggle={() => toggleSection('api')}
                    badge={providers.length}
                  />
                  {isSectionExpanded('api') && providers.map((p) => (
                    <button
                      key={p.provider}
                      disabled={!p.available}
                      onClick={() => {
                        setSelectedWebsiteId(null)
                        setSelectedProvider(p.provider)
                        setAiSelectedProviderOrch(p.provider)
                        if (p.provider === 'opensource-ai') {
                          setThinkEnabled(resolveAiThinkingForScopeProviderOrch('chat', 'opensource-ai'))
                        }
                      }}
                      className={cn(
                        'flex w-full items-center border-b border-border/40 px-3 py-2.5 text-left text-xs transition-colors',
                        selectedWebsiteId === null && selectedProvider === p.provider
                          ? 'bg-primary text-primary-foreground'
                          : p.available
                            ? 'text-foreground hover:bg-muted/40'
                            : 'text-muted-foreground/50 cursor-not-allowed',
                      )}
                      style={{ paddingLeft: '24px' }}
                    >
                      <span className="truncate">{p.label}</span>
                      {!p.available && <span className="ml-1 shrink-0 text-[10px] opacity-60">off</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Web AI sites */}
              {aiWebsites.length > 0 && (
                <div>
                  <SidebarGroupHeaderBlock
                    name="Web"
                    expanded={isSectionExpanded('web')}
                    onToggle={() => toggleSection('web')}
                    badge={aiWebsites.length}
                  />
                  {isSectionExpanded('web') && aiWebsites.map((site) => (
                    <button
                      key={site.id}
                      onClick={() => {
                        setSelectedWebsiteId(site.id)
                        setSelectedProvider(null)
                      }}
                      className={cn(
                        'flex w-full items-center border-b border-border/40 px-3 py-2.5 text-left text-xs transition-colors',
                        selectedWebsiteId === site.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted/40',
                      )}
                      style={{ paddingLeft: '24px' }}
                    >
                      <span className="truncate">{site.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {providers.length === 0 && aiWebsites.length === 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  No providers. Check AI Settings.
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <section className="relative min-h-0 flex-1 overflow-hidden">
        {dashboardSelected && (
          <CodexUsageDashboardOrch />
        )}

        {!dashboardSelected && selectedWebsiteForChrome && (
          <UrlDocumentBlock
            key={selectedWebsiteForChrome.id}
            url={selectedWebsiteForChrome.url}
            partition={selectedWebsiteForChrome.partition}
            hideHeader={!webviewHeaderVisible}
            suspended={!active || (isIosPhone && !sidebarCollapsed)}
            className="h-full"
          />
        )}

        {!dashboardSelected && !selectedWebsiteForChrome && (
          <div className="flex h-full flex-col px-4 py-4">
            {/* Model / think controls */}
            {selectedProvider && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {selectedModel && (
                  <span className="text-xs text-muted-foreground">
                    Model: {selectedModel} (from AI Settings)
                  </span>
                )}
                {selectedProvider === 'opensource-ai' && (
                  <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-muted-foreground">
                    <span>Think</span>
                    <Switch
                      checked={thinkEnabled}
                      onCheckedChange={(checked) => {
                        setThinkEnabled(checked)
                        setAiScopeProviderThinkingOrch('chat', 'opensource-ai', checked)
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pb-4">
              {messages.length === 0 && !loading && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {selectedProvider ? 'Start a conversation.' : 'Select a provider from the sidebar.'}
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <Card
                    className={`max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card'
                    }`}
                  >
                    <CardContent className="p-3">
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:overflow-x-auto [&_code]:break-all">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                      )}
                      <div className="mt-2 text-[11px] leading-relaxed opacity-80">
                        {msg.role === 'user' ? (
                          <span>{formatTimestamp(msg.requested_at) ?? 'timestamp unavailable'}</span>
                        ) : (
                          <span>
                            {[formatTimestamp(msg.responded_at), msg.provider, msg.model].filter(Boolean).join(' • ')}
                            {(msg.latency_ms != null) && ` • ${msg.latency_ms} ms`}
                            {(msg.input_tokens != null || msg.output_tokens != null || msg.total_tokens != null) && (
                              ` • tokens in:${msg.input_tokens ?? '-'} out:${msg.output_tokens ?? '-'} total:${msg.total_tokens ?? '-'}`
                            )}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <Card className="bg-card">
                    <CardContent className="flex items-center gap-2 p-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </CardContent>
                  </Card>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Input */}
            <div className="flex items-end gap-2 border-t border-border/60 pt-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedProvider ? 'Type a message...' : 'Select a provider first'}
                disabled={!selectedProvider || loading}
                rows={1}
                className="min-h-[44px] max-h-[200px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || !selectedProvider || loading}
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
