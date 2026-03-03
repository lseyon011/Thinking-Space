import {
  clearAiManualCredentialsBlock,
  getManualAzureCredentialsBlock,
  getManualClaudeApiKeyBlock,
  getManualOpenSourceAiCredentialsBlock,
  getManualOpenAiApiKeyBlock,
  setManualOpenSourceAiCredentialsBlock,
  setManualAzureCredentialsBlock,
  setManualClaudeCredentialsBlock,
  setManualOpenAiCredentialsBlock,
} from '@/services/lego_blocks/integrations/aiCredentialStoreBlock'

export interface NativeAiLoginState {
  claudeApiKey: string
  openAiApiKey: string
  azureApiKey: string
  azureEndpoint: string
  azureDeployment: string
  azureApiVersion: string
  openSourceAiBaseUrl: string
  openSourceAiApiKey: string
}

export function getNativeAiLoginStateOrch(): NativeAiLoginState {
  const azure = getManualAzureCredentialsBlock()
  const openSourceAi = getManualOpenSourceAiCredentialsBlock()
  return {
    claudeApiKey: getManualClaudeApiKeyBlock() ?? '',
    openAiApiKey: getManualOpenAiApiKeyBlock() ?? '',
    azureApiKey: azure?.apiKey ?? '',
    azureEndpoint: azure?.endpoint ?? '',
    azureDeployment: azure?.deployment ?? '',
    azureApiVersion: azure?.apiVersion ?? '',
    openSourceAiBaseUrl: openSourceAi?.baseUrl ?? '',
    openSourceAiApiKey: openSourceAi?.apiKey ?? '',
  }
}

export function setNativeClaudeLoginOrch(apiKey: string): NativeAiLoginState {
  setManualClaudeCredentialsBlock(apiKey)
  return getNativeAiLoginStateOrch()
}

export function setNativeOpenAiLoginOrch(apiKey: string): NativeAiLoginState {
  setManualOpenAiCredentialsBlock(apiKey)
  return getNativeAiLoginStateOrch()
}

export function setNativeAzureLoginOrch(input: {
  apiKey: string
  endpoint?: string
  deployment?: string
  apiVersion?: string
}): NativeAiLoginState {
  setManualAzureCredentialsBlock(input)
  return getNativeAiLoginStateOrch()
}

export function setNativeOpenSourceAiLoginOrch(input: {
  baseUrl?: string
  apiKey?: string
}): NativeAiLoginState {
  setManualOpenSourceAiCredentialsBlock(input)
  return getNativeAiLoginStateOrch()
}

export function clearNativeAiLoginsOrch(): NativeAiLoginState {
  clearAiManualCredentialsBlock()
  return getNativeAiLoginStateOrch()
}
