import type { AiProvider } from '../lego_blocks/aiProviderBlock'
import type { AiSettingsScope } from '../lego_blocks/aiSettingsBlock'
import { resolveAiSelectionOrch } from './aiSettingsOrch'
import { sendChatWithTelemetryOrch } from './chatOrch'
import type { AiTelemetryEvent } from './aiTelemetryOrch'

export type AiAssistAction = 'grammar' | 'clarity' | 'structure' | 'tone'

export interface RunAiAssistInput {
  provider?: AiProvider
  model?: string
  scope?: AiSettingsScope
  useCase?: string
  action: AiAssistAction
  content: string
}

export interface RunAiAssistResult {
  action: AiAssistAction
  provider: AiProvider
  model: string
  originalContent: string
  suggestedContent: string
  changed: boolean
  requested_at?: string
  responded_at?: string
  latency_ms?: number
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  telemetry?: AiTelemetryEvent
}

const ACTION_GUIDANCE: Record<AiAssistAction, string> = {
  grammar: 'Fix grammar, spelling, punctuation, and small usage issues without changing meaning.',
  clarity: 'Improve clarity and readability with minimal edits while preserving intent.',
  structure: 'Improve flow and structure using existing markdown style while keeping meaning intact.',
  tone: 'Adjust tone to be supportive, concise, and professional while preserving core ideas.',
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  if (!match) return { frontmatter: '', body: content }
  return {
    frontmatter: match[0],
    body: content.slice(match[0].length),
  }
}

function stripMarkdownCodeFence(content: string): string {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : content
}

function buildAssistPrompt(action: AiAssistAction, body: string): string {
  return [
    'You are a writing assistant for markdown notes.',
    `Task: ${ACTION_GUIDANCE[action]}`,
    'Rules:',
    '- Return only the revised markdown body text.',
    '- Do not include explanations, labels, or code fences.',
    '- Preserve factual meaning and avoid invented details.',
    '- If no change is needed, return the original body unchanged.',
    '',
    '<markdown_body>',
    body,
    '</markdown_body>',
  ].join('\n')
}

export async function runAiAssistOrch(input: RunAiAssistInput): Promise<RunAiAssistResult> {
  const source = input.content.replace(/\r\n/g, '\n')
  const { frontmatter, body } = splitFrontmatter(source)
  const prompt = buildAssistPrompt(input.action, body)
  const selection = await resolveAiSelectionOrch({
    provider: input.provider ?? null,
    model: input.model ?? null,
    scope: input.scope ?? null,
  })
  if (!selection) {
    throw new Error('No AI provider available. Configure one in AI Settings.')
  }

  const { response, telemetryEvent } = await sendChatWithTelemetryOrch(
    selection.provider,
    [{ role: 'user', content: prompt }],
    { model: selection.model },
    {
      useCase: input.useCase || 'markdown.assist',
      metadata: {
        action: input.action,
        scope: input.scope || null,
      },
    },
  )

  let revisedBody = stripMarkdownCodeFence(response.content).replace(/\r\n/g, '\n')
  if (frontmatter) {
    // Some models occasionally echo full markdown; keep YAML source-of-truth unchanged.
    revisedBody = splitFrontmatter(revisedBody).body
  }

  const suggestedContent = frontmatter ? `${frontmatter}${revisedBody}` : revisedBody

  return {
    action: input.action,
    provider: response.provider,
    model: response.model,
    originalContent: source,
    suggestedContent,
    changed: suggestedContent !== source,
    requested_at: response.requested_at,
    responded_at: response.responded_at,
    latency_ms: response.latency_ms,
    input_tokens: response.input_tokens,
    output_tokens: response.output_tokens,
    total_tokens: response.total_tokens,
    telemetry: telemetryEvent,
  }
}
