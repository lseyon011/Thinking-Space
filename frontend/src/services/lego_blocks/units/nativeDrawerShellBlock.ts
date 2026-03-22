import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

export interface NativeDrawerShellStateBlock {
  kind: string
  title: string
  currentPath: string
  currentSearch: string
  open?: boolean
}

export interface NativeDrawerActionEventBlock {
  type?: string
  payloadJson?: string
}

interface NativeDrawerShellPluginBlock {
  setState(options: NativeDrawerShellStateBlock): Promise<void>
  open(): Promise<void>
  close(): Promise<void>
  addListener(
    eventName: 'nativeDrawerAction',
    listenerFunc: (payload: NativeDrawerActionEventBlock) => void,
  ): Promise<PluginListenerHandle>
}

const NativeDrawerShell = registerPlugin<NativeDrawerShellPluginBlock>('NativeDrawerShell')

export function hasNativeDrawerShellBlock(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativeDrawerShell')
}

export async function setNativeDrawerShellStateBlock(options: NativeDrawerShellStateBlock): Promise<void> {
  await NativeDrawerShell.setState(options)
}

export async function openNativeDrawerShellBlock(): Promise<void> {
  await NativeDrawerShell.open()
}

export async function closeNativeDrawerShellBlock(): Promise<void> {
  await NativeDrawerShell.close()
}

export async function addNativeDrawerShellActionListenerBlock(
  handler: (payload: NativeDrawerActionEventBlock) => void,
): Promise<PluginListenerHandle> {
  return NativeDrawerShell.addListener('nativeDrawerAction', handler)
}
