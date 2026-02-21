import { defaultUrlTransform } from 'react-markdown'
import { isThinkingSpaceWikilinkHrefBlock } from './obsidianWikilinkBlock'

export function thinkingSpaceMarkdownUrlTransformBlock(url: string): string {
  return isThinkingSpaceWikilinkHrefBlock(url) ? url : defaultUrlTransform(url)
}
