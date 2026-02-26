import { defaultUrlTransform } from 'react-markdown'
import { isThinkingSpaceWikilinkHrefBlock } from '@/services/lego_blocks/integrations/obsidianWikilinkBlock'

export function thinkingSpaceMarkdownUrlTransformBlock(url: string): string {
  return isThinkingSpaceWikilinkHrefBlock(url) ? url : defaultUrlTransform(url)
}
