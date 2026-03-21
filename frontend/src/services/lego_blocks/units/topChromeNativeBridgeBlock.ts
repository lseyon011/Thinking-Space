import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

interface TopChromeStateBlock {
  title: string
  visible?: boolean
  showSearch?: boolean
  showCreate?: boolean
}

interface TopChromePluginBlock {
  setState(options: TopChromeStateBlock): Promise<void>
  show(): Promise<void>
  hide(): Promise<void>
  addListener(eventName: 'topChromeMenuTap', listenerFunc: () => void): Promise<PluginListenerHandle>
  addListener(eventName: 'topChromeSearchTap', listenerFunc: () => void): Promise<PluginListenerHandle>
  addListener(eventName: 'topChromeCreateTap', listenerFunc: () => void): Promise<PluginListenerHandle>
}

const TopChrome = registerPlugin<TopChromePluginBlock>('TopChrome')

export async function setTopChromeStateBlock(options: TopChromeStateBlock): Promise<void> {
  await TopChrome.setState(options)
}

export async function showTopChromeBlock(): Promise<void> {
  await TopChrome.show()
}

export async function hideTopChromeBlock(): Promise<void> {
  await TopChrome.hide()
}

export async function addTopChromeMenuTapListenerBlock(handler: () => void): Promise<PluginListenerHandle> {
  return TopChrome.addListener('topChromeMenuTap', handler)
}

export async function addTopChromeSearchTapListenerBlock(handler: () => void): Promise<PluginListenerHandle> {
  return TopChrome.addListener('topChromeSearchTap', handler)
}

export async function addTopChromeCreateTapListenerBlock(handler: () => void): Promise<PluginListenerHandle> {
  return TopChrome.addListener('topChromeCreateTap', handler)
}
