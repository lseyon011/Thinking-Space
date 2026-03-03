import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from '@/services/lego_blocks/units/storageKeyBlock'

export interface ManualClaudeCredentials {
  apiKey: string
}

export interface ManualOpenAiCredentials {
  apiKey: string
}

export interface ManualAzureCredentials {
  apiKey: string
  endpoint: string
  deployment: string
  apiVersion: string
}

export interface ManualOpenSourceAiCredentials {
  baseUrl: string
  apiKey?: string
}

export interface AiManualCredentials {
  claude?: ManualClaudeCredentials
  openaiCodex?: ManualOpenAiCredentials
  azure?: ManualAzureCredentials
  opensourceAi?: ManualOpenSourceAiCredentials
}

export const DEFAULT_AZURE_OPENAI_ENDPOINT = 'https://fuchs-lab-openai.openai.azure.com'
export const DEFAULT_AZURE_OPENAI_DEPLOYMENT = 'gpt-5'
export const DEFAULT_AZURE_OPENAI_API_VERSION = '2024-12-01-preview'
export const DEFAULT_OPENSOURCE_AI_BASE_URL = 'http://127.0.0.1:1234/v1'

const DEFAULT_MANUAL_CREDENTIALS: AiManualCredentials = {}

function sanitizeValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function sanitizeClaude(raw: unknown): ManualClaudeCredentials | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const apiKey = sanitizeValue((raw as Record<string, unknown>).apiKey)
  if (!apiKey) return undefined
  return { apiKey }
}

function sanitizeOpenAi(raw: unknown): ManualOpenAiCredentials | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const apiKey = sanitizeValue((raw as Record<string, unknown>).apiKey)
  if (!apiKey) return undefined
  return { apiKey }
}

function sanitizeAzure(raw: unknown): ManualAzureCredentials | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const apiKey = sanitizeValue(record.apiKey)
  if (!apiKey) return undefined
  return {
    apiKey,
    endpoint: sanitizeValue(record.endpoint) || DEFAULT_AZURE_OPENAI_ENDPOINT,
    deployment: sanitizeValue(record.deployment) || DEFAULT_AZURE_OPENAI_DEPLOYMENT,
    apiVersion: sanitizeValue(record.apiVersion) || DEFAULT_AZURE_OPENAI_API_VERSION,
  }
}

function sanitizeOpenSourceAi(raw: unknown): ManualOpenSourceAiCredentials | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const baseUrl = sanitizeValue(record.baseUrl) || DEFAULT_OPENSOURCE_AI_BASE_URL
  const apiKey = sanitizeValue(record.apiKey) || undefined
  return {
    baseUrl,
    ...(apiKey ? { apiKey } : {}),
  }
}

function sanitizeManualCredentials(raw: unknown): AiManualCredentials {
  if (!raw || typeof raw !== 'object') return {}
  const record = raw as Record<string, unknown>
  const claude = sanitizeClaude(record.claude)
  const openaiCodex = sanitizeOpenAi(record.openaiCodex)
  const azure = sanitizeAzure(record.azure)
  const opensourceAi = sanitizeOpenSourceAi(record.opensourceAi)
  return {
    ...(claude ? { claude } : {}),
    ...(openaiCodex ? { openaiCodex } : {}),
    ...(azure ? { azure } : {}),
    ...(opensourceAi ? { opensourceAi } : {}),
  }
}

export function readAiManualCredentialsBlock(): AiManualCredentials {
  const raw = getJsonStorageItem<unknown>(STORAGE_KEYS.aiManualCredentials, DEFAULT_MANUAL_CREDENTIALS)
  return sanitizeManualCredentials(raw)
}

export function writeAiManualCredentialsBlock(next: AiManualCredentials): AiManualCredentials {
  const normalized = sanitizeManualCredentials(next)
  setJsonStorageItem(STORAGE_KEYS.aiManualCredentials, normalized)
  return normalized
}

export function clearAiManualCredentialsBlock(): AiManualCredentials {
  return writeAiManualCredentialsBlock({})
}

export function setManualClaudeCredentialsBlock(apiKey: string): AiManualCredentials {
  const current = readAiManualCredentialsBlock()
  const normalized = sanitizeValue(apiKey)
  if (!normalized) {
    return writeAiManualCredentialsBlock({
      ...current,
      claude: undefined,
    })
  }
  return writeAiManualCredentialsBlock({
    ...current,
    claude: { apiKey: normalized },
  })
}

export function setManualOpenAiCredentialsBlock(apiKey: string): AiManualCredentials {
  const current = readAiManualCredentialsBlock()
  const normalized = sanitizeValue(apiKey)
  if (!normalized) {
    return writeAiManualCredentialsBlock({
      ...current,
      openaiCodex: undefined,
    })
  }
  return writeAiManualCredentialsBlock({
    ...current,
    openaiCodex: { apiKey: normalized },
  })
}

export function setManualAzureCredentialsBlock(input: {
  apiKey: string
  endpoint?: string
  deployment?: string
  apiVersion?: string
}): AiManualCredentials {
  const current = readAiManualCredentialsBlock()
  const apiKey = sanitizeValue(input.apiKey)
  if (!apiKey) {
    return writeAiManualCredentialsBlock({
      ...current,
      azure: undefined,
    })
  }
  return writeAiManualCredentialsBlock({
    ...current,
    azure: {
      apiKey,
      endpoint: sanitizeValue(input.endpoint) || DEFAULT_AZURE_OPENAI_ENDPOINT,
      deployment: sanitizeValue(input.deployment) || DEFAULT_AZURE_OPENAI_DEPLOYMENT,
      apiVersion: sanitizeValue(input.apiVersion) || DEFAULT_AZURE_OPENAI_API_VERSION,
    },
  })
}

export function getManualClaudeApiKeyBlock(): string | null {
  return readAiManualCredentialsBlock().claude?.apiKey ?? null
}

export function getManualOpenAiApiKeyBlock(): string | null {
  return readAiManualCredentialsBlock().openaiCodex?.apiKey ?? null
}

export function getManualAzureCredentialsBlock(): ManualAzureCredentials | null {
  return readAiManualCredentialsBlock().azure ?? null
}

export function setManualOpenSourceAiCredentialsBlock(input: {
  baseUrl?: string
  apiKey?: string
}): AiManualCredentials {
  const current = readAiManualCredentialsBlock()
  const baseUrl = sanitizeValue(input.baseUrl) || DEFAULT_OPENSOURCE_AI_BASE_URL
  const apiKey = sanitizeValue(input.apiKey) || undefined
  return writeAiManualCredentialsBlock({
    ...current,
    opensourceAi: {
      baseUrl,
      ...(apiKey ? { apiKey } : {}),
    },
  })
}

export function getManualOpenSourceAiCredentialsBlock(): ManualOpenSourceAiCredentials | null {
  return readAiManualCredentialsBlock().opensourceAi ?? null
}
