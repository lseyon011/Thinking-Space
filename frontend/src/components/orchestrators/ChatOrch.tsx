import { useState, useEffect, useRef } from 'react'
import { Loader2, Send, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/lego_blocks/ui/button'
import { Card, CardContent } from '@/components/lego_blocks/ui/card'
import {
  type AiProvider,
  type AiProviderStatus,
  type ChatMessage,
  type ChatResponse,
  listProvidersOrch,
  sendChatOrch,
} from '@/services/orchestrators/chatOrch'

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

export default function ChatOrch() {
  const [providers, setProviders] = useState<AiProviderStatus[]>([])
  const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null)
  const [messages, setMessages] = useState<ChatTimelineMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)
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
    listProvidersOrch()
      .then((p) => {
        setProviders(p)
        const firstAvailable = p.find((x) => x.available)
        if (firstAvailable) setSelectedProvider(firstAvailable.provider)
      })
      .catch((err) => setError(err.message))
      .finally(() => setProvidersLoading(false))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      const response: ChatResponse = await sendChatOrch(
        selectedProvider,
        allMessages,
        selectedProvider === 'codex-cli'
          ? { threadId: latestCodexCliThreadId() }
          : undefined,
      )
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        provider: response.provider,
        model: response.model,
        requested_at: response.requested_at,
        responded_at: response.responded_at,
        latency_ms: response.latency_ms,
        input_tokens: response.input_tokens,
        output_tokens: response.output_tokens,
        total_tokens: response.total_tokens,
        thread_id: response.thread_id,
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

  const availableProviders = providers.filter((p) => p.available)

  return (
    <div className="flex h-full flex-col">
      {/* Provider selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {providersLoading ? (
          <span className="text-sm text-muted-foreground">Detecting providers...</span>
        ) : availableProviders.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            No AI providers available. Check credentials.
          </div>
        ) : (
          providers.map((p) => (
            <button
              key={p.provider}
              disabled={!p.available}
              onClick={() => setSelectedProvider(p.provider)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                selectedProvider === p.provider
                  ? 'border-primary bg-primary text-primary-foreground'
                  : p.available
                    ? 'border-border bg-background text-foreground hover:bg-accent'
                    : 'border-border/50 bg-muted text-muted-foreground/50 cursor-not-allowed'
              }`}
            >
              {p.label}
              {!p.available && <span className="ml-1 text-xs opacity-60">unavailable</span>}
            </button>
          ))
        )}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Start a conversation.
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
  )
}
