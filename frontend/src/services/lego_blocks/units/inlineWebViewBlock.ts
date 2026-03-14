import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

interface InlineWebViewPlugin {
  open(options: { url: string; x: number; y: number; width: number; height: number }): Promise<void>
  close(): Promise<void>
  updateFrame(options: { x: number; y: number; width: number; height: number }): Promise<void>
  addListener(event: 'inlineWebViewEdgeSwipeOpen', handler: () => void): Promise<PluginListenerHandle>
  addListener(event: 'inlineWebViewEdgeSwipeClose', handler: () => void): Promise<PluginListenerHandle>
}

const InlineWebView = registerPlugin<InlineWebViewPlugin>('InlineWebView')

export async function openInlineWebViewBlock(url: string, rect: DOMRect): Promise<void> {
  await InlineWebView.open({ url, x: rect.left, y: rect.top, width: rect.width, height: rect.height })
}

export async function closeInlineWebViewBlock(): Promise<void> {
  await InlineWebView.close()
}

export async function updateInlineWebViewFrameBlock(rect: DOMRect): Promise<void> {
  await InlineWebView.updateFrame({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
}

export async function addInlineWebViewSwipeOpenListenerBlock(handler: () => void): Promise<PluginListenerHandle> {
  return InlineWebView.addListener('inlineWebViewEdgeSwipeOpen', handler)
}

export async function addInlineWebViewSwipeCloseListenerBlock(handler: () => void): Promise<PluginListenerHandle> {
  return InlineWebView.addListener('inlineWebViewEdgeSwipeClose', handler)
}
