import {
  DEFAULT_UI_THEME_ID_BLOCK,
  getUIShellThemeProfileBlock,
  normalizeUIThemeIdBlock,
  type UIShellThemeProfileBlock,
  type UIThemeId,
} from '../lego_blocks/uiThemeBlock'
import { STORAGE_KEYS, getStorageItem, setStorageItem } from './storageOrch'

interface ApplyUIThemeOptions {
  documentRef?: Document | null
}

function resolveDocument(documentRef?: Document | null): Document | null {
  if (documentRef) return documentRef
  if (typeof document === 'undefined') return null
  return document
}

export function getStoredUIThemeOrch(): UIThemeId {
  return normalizeUIThemeIdBlock(getStorageItem(STORAGE_KEYS.appTheme))
}

export function setStoredUIThemeOrch(themeId: UIThemeId): void {
  setStorageItem(STORAGE_KEYS.appTheme, themeId)
}

export function applyUIThemeOrch(themeId: UIThemeId, options: ApplyUIThemeOptions = {}): void {
  const documentRef = resolveDocument(options.documentRef)
  if (!documentRef) return

  const normalizedTheme = normalizeUIThemeIdBlock(themeId)
  documentRef.documentElement.setAttribute('data-ltm-theme', normalizedTheme)
  if (documentRef.body) {
    documentRef.body.setAttribute('data-ltm-theme', normalizedTheme)
  }
}

export function initializeUIThemeOrch(options: ApplyUIThemeOptions = {}): UIThemeId {
  const storedTheme = getStoredUIThemeOrch() || DEFAULT_UI_THEME_ID_BLOCK
  applyUIThemeOrch(storedTheme, options)
  return storedTheme
}

export function getUIShellThemeProfileOrch(themeId: UIThemeId): UIShellThemeProfileBlock {
  return getUIShellThemeProfileBlock(normalizeUIThemeIdBlock(themeId))
}

export type { UIThemeId } from '../lego_blocks/uiThemeBlock'
export type {
  UIShellMaterialProfileBlock,
  UIShellMotionProfileBlock,
  UIShellThemeProfileBlock,
} from '../lego_blocks/uiThemeBlock'
export { UI_THEME_OPTIONS_BLOCK } from '../lego_blocks/uiThemeBlock'
