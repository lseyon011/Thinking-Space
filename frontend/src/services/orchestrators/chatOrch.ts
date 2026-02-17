import {
  sendChatBlock,
  type ChatMessage,
  type ChatResponse,
  type ChatSendOptions,
} from '../lego_blocks/aiChatBlock'
import { listProvidersBlock, type AiProvider, type AiProviderStatus } from '../lego_blocks/aiProviderBlock'

export type {
  AiProvider,
  AiProviderStatus,
  ChatMessage,
  ChatResponse,
  ChatSendOptions,
}

export async function listProvidersOrch(): Promise<AiProviderStatus[]> {
  return listProvidersBlock()
}

export async function sendChatOrch(
  provider: AiProvider,
  messages: ChatMessage[],
  options?: ChatSendOptions,
): Promise<ChatResponse> {
  return sendChatBlock(provider, messages, options)
}
