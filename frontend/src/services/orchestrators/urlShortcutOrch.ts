import { readMarkdownDocument } from '@/services/orchestrators/markdownDocumentsOrch'
import { createFileOrch } from '@/services/orchestrators/fileSystemOrch'
import {
  domainFromUrlBlock,
  isValidHttpUrlBlock,
  parseUrlShortcutBlock,
  serializeUrlShortcutBlock,
} from '@/services/lego_blocks/units/urlShortcutBlock'

export async function readUrlShortcutOrch(path: string): Promise<{ url: string }> {
  const doc = await readMarkdownDocument(path, { includeHash: false })
  const result = parseUrlShortcutBlock(doc.content)
  if (!result) throw new Error('Invalid .url file — no valid URL found')
  return result
}

export async function createUrlShortcutOrch(
  parentPath: string,
  url: string,
  preferredName?: string,
): Promise<string> {
  if (!isValidHttpUrlBlock(url)) throw new Error('Invalid URL — only http/https URLs are supported')
  const name = preferredName || `${domainFromUrlBlock(url)}.url`
  const safeName = name.endsWith('.url') ? name : `${name}.url`
  const content = serializeUrlShortcutBlock(url)
  return createFileOrch(parentPath, safeName, content)
}
