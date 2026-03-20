import {
  DEFAULT_UI_COLOR_MODE_ID_BLOCK,
  DEFAULT_UI_THEME_ID_BLOCK,
  normalizeUIColorModeIdBlock,
  normalizeUIThemeIdBlock,
  type UIColorModeId,
  type UIThemeId,
} from '@/services/lego_blocks/units/uiThemeBlock'
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

export function getStoredUIColorModeOrch(): UIColorModeId {
  return normalizeUIColorModeIdBlock(getStorageItem(STORAGE_KEYS.appColorMode))
}

export function setStoredUIColorModeOrch(colorModeId: UIColorModeId): void {
  setStorageItem(STORAGE_KEYS.appColorMode, colorModeId)
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

export function applyUIColorModeOrch(colorModeId: UIColorModeId, options: ApplyUIThemeOptions = {}): void {
  const documentRef = resolveDocument(options.documentRef)
  if (!documentRef) return

  const normalizedColorMode = normalizeUIColorModeIdBlock(colorModeId)
  const isDarkMode = normalizedColorMode === 'dark'
  const root = documentRef.documentElement

  root.setAttribute('data-ltm-color-mode', normalizedColorMode)
  root.classList.toggle('dark', isDarkMode)
  root.classList.toggle('theme-dark', isDarkMode)
  root.classList.toggle('theme-light', !isDarkMode)
  root.style.colorScheme = normalizedColorMode

  if (documentRef.body) {
    documentRef.body.setAttribute('data-ltm-color-mode', normalizedColorMode)
    documentRef.body.classList.toggle('dark', isDarkMode)
    documentRef.body.classList.toggle('theme-dark', isDarkMode)
    documentRef.body.classList.toggle('theme-light', !isDarkMode)
  }
}

export function initializeUIThemeOrch(options: ApplyUIThemeOptions = {}): UIThemeId {
  const storedTheme = getStoredUIThemeOrch() || DEFAULT_UI_THEME_ID_BLOCK
  applyUIThemeOrch(storedTheme, options)
  return storedTheme
}

export function initializeUIColorModeOrch(options: ApplyUIThemeOptions = {}): UIColorModeId {
  const storedColorMode = getStoredUIColorModeOrch() || DEFAULT_UI_COLOR_MODE_ID_BLOCK
  applyUIColorModeOrch(storedColorMode, options)
  return storedColorMode
}

export type { UIThemeId } from '@/services/lego_blocks/units/uiThemeBlock'
export type { UIColorModeId } from '@/services/lego_blocks/units/uiThemeBlock'
export { UI_COLOR_MODE_OPTIONS_BLOCK, UI_THEME_OPTIONS_BLOCK } from '@/services/lego_blocks/units/uiThemeBlock'
