import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

export interface NativeDrawerContentStateBlock {
  kind?: string
  title?: string
  currentPath?: string
  currentSearch?: string
  isOpen?: boolean
}

export interface NativeDrawerContentActionBlock {
  type: string
  payloadJson?: string
}

interface NativeDrawerContentPluginBlock {
  getState(): Promise<NativeDrawerContentStateBlock>
  postAction(options: NativeDrawerContentActionBlock): Promise<void>
  addListener(
    eventName: 'nativeDrawerState',
    listenerFunc: (payload: NativeDrawerContentStateBlock) => void,
  ): Promise<PluginListenerHandle>
}

const NativeDrawerContent = registerPlugin<NativeDrawerContentPluginBlock>('NativeDrawerContent')

export function hasNativeDrawerContentBlock(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativeDrawerContent')
}

export async function getNativeDrawerContentStateBlock(): Promise<NativeDrawerContentStateBlock> {
  return NativeDrawerContent.getState()
}

export async function postNativeDrawerContentActionBlock(action: NativeDrawerContentActionBlock): Promise<void> {
  await NativeDrawerContent.postAction(action)
}

export async function addNativeDrawerContentStateListenerBlock(
  handler: (payload: NativeDrawerContentStateBlock) => void,
): Promise<PluginListenerHandle> {
  return NativeDrawerContent.addListener('nativeDrawerState', handler)
}
