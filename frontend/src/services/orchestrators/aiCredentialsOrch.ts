import {
  clearAiManualCredentialsBlock,
  getManualAzureCredentialsBlock,
  getManualClaudeApiKeyBlock,
  getManualOpenAiApiKeyBlock,
  setManualAzureCredentialsBlock,
  setManualClaudeCredentialsBlock,
  setManualOpenAiCredentialsBlock,
} from '../lego_blocks/aiCredentialStoreBlock'

export interface NativeAiLoginState {
  claudeApiKey: string
  openAiApiKey: string
  azureApiKey: string
  azureEndpoint: string
  azureDeployment: string
  azureApiVersion: string
}

export function getNativeAiLoginStateOrch(): NativeAiLoginState {
  const azure = getManualAzureCredentialsBlock()
  return {
    claudeApiKey: getManualClaudeApiKeyBlock() ?? '',
    openAiApiKey: getManualOpenAiApiKeyBlock() ?? '',
    azureApiKey: azure?.apiKey ?? '',
    azureEndpoint: azure?.endpoint ?? '',
    azureDeployment: azure?.deployment ?? '',
    azureApiVersion: azure?.apiVersion ?? '',
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

export function clearNativeAiLoginsOrch(): NativeAiLoginState {
  clearAiManualCredentialsBlock()
  return getNativeAiLoginStateOrch()
}
