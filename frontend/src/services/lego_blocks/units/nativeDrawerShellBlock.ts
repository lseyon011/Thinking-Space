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
  side?: 'left' | 'right'
  payloadJson?: string
}

interface NativeDrawerShellPluginBlock {
  setState(options: NativeDrawerShellStateBlock): Promise<void>
  openLeft(): Promise<void>
  openRight(): Promise<void>
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

export async function openLeftNativeDrawerShellBlock(): Promise<void> {
  await NativeDrawerShell.openLeft()
}

export async function openRightNativeDrawerShellBlock(): Promise<void> {
  await NativeDrawerShell.openRight()
}

export async function closeNativeDrawerShellBlock(): Promise<void> {
  await NativeDrawerShell.close()
}

// Keep legacy aliases for compatibility
export const openNativeDrawerShellBlock = openLeftNativeDrawerShellBlock

export async function addNativeDrawerShellActionListenerBlock(
  handler: (payload: NativeDrawerActionEventBlock) => void,
): Promise<PluginListenerHandle> {
  return NativeDrawerShell.addListener('nativeDrawerAction', handler)
}
