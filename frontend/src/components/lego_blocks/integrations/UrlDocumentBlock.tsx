import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ExternalLink, Globe, Loader2, RotateCw, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useElectronWebviewConsoleMessageBlock } from '@/components/lego_blocks/hooks/shared/useElectronWebviewConsoleMessageBlock'
import { useElectronWebviewLoadErrorBlock } from '@/components/lego_blocks/hooks/shared/useElectronWebviewLoadErrorBlock'
import PasswordAutofillOverlayBlock from '@/components/lego_blocks/integrations/PasswordAutofillOverlayBlock'
import { readUrlShortcutOrch } from '@/services/orchestrators/urlShortcutOrch'
import { isValidHttpUrlBlock } from '@/services/lego_blocks/units/urlShortcutBlock'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import { createPasswordVaultEntryIdOrch } from '@/services/orchestrators/passwordManagerOrch'
import {
  getPasswordVaultSessionSnapshotOrch,
  savePasswordVaultSessionVaultOrch,
  subscribePasswordVaultSessionOrch,
  unlockPasswordVaultSessionOrch,
} from '@/services/orchestrators/passwordManagerSessionOrch'
import type { PasswordVaultEntryBlock } from '@/services/orchestrators/passwordManagerOrch'
import {
  openInlineWebViewBlock,
  closeInlineWebViewBlock,
  updateInlineWebViewFrameBlock,
} from '@/services/lego_blocks/units/inlineWebViewBlock'
import {
  derivePasswordEntryTitleBlock,
  findMatchingPasswordEntriesBlock,
  findPasswordSaveTargetBlock,
  type PasswordAutofillWebContextBlock,
} from '@/services/lego_blocks/units/passwordAutofillMatchBlock'
import {
  buildPasswordAutofillFillScriptBlock,
  probePasswordAutofillContextBlock,
} from '@/services/lego_blocks/units/passwordAutofillWebviewBlock'
import { cn } from '@/lib/utils'

const LINK_WEBVIEW_PARTITION = 'persist:thinking-space-links'

interface ElectronWebviewElementBlock extends HTMLElement {
  canGoBack?: () => boolean
  goBack?: () => void
  goForward?: () => void
  reload?: () => void
  executeJavaScript?: (script: string, userGesture?: boolean) => Promise<unknown>
}

interface UrlDocumentBlockProps {
  /** Path to a .url file, OR a direct URL to display. */
  path?: string
  url?: string
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
  /** Override the Electron webview partition. Defaults to the shared links partition. */
  partition?: string
  /** Hide the URL bar (e.g. when top chrome provides a header toggle). */
  hideHeader?: boolean
  /** Suspend the native WKWebView (iOS) — use when a native-layer overlay (e.g. drawer) is open. */
  suspended?: boolean
}

function UrlDocumentBlock({
  path,
  url: directUrl,
  onClose,
  showCloseButton,
  className,
  partition,
  hideHeader,
  suspended,
}: UrlDocumentBlockProps) {
  const navigate = useNavigate()
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(directUrl ?? null)
  const [loading, setLoading] = useState(!directUrl)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [canGoBack, setCanGoBack] = useState(false)
  const webviewRef = useRef<HTMLElement | null>(null)
  const contentAreaRef = useRef<HTMLDivElement | null>(null)
  const passwordProbeInFlightRef = useRef(false)
  const isElectronRuntime = Boolean(window.electronAPI?.isElectron)
  // InlineWebView is iOS-only; exclude Electron even though Capacitor reports isNativePlatform() there
  const isCapacitorRuntime = isCapacitorNative() && !isElectronRuntime

  // Resolve URL from .url file
  useEffect(() => {
    if (directUrl) {
      setResolvedUrl(directUrl)
      setLoading(false)
      setError(null)
      return
    }
    if (!path) {
      setError('No file path or URL provided')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    readUrlShortcutOrch(path)
      .then(result => {
        if (!cancelled) {
          setResolvedUrl(result.url)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to read .url file')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [path, directUrl])

  const isTrusted = useMemo(
    () => resolvedUrl !== null && isValidHttpUrlBlock(resolvedUrl),
    [resolvedUrl],
  )
  useElectronWebviewLoadErrorBlock({
    enabled: isElectronRuntime && isTrusted,
    webviewRef,
    resolvedUrl,
    logSource: 'webview',
  })
  useElectronWebviewConsoleMessageBlock({
    enabled: isElectronRuntime && isTrusted,
    webviewRef,
    resolvedUrl,
  })

  // Strip Electron/app tokens so webview looks like a plain Chrome browser to sites like Gmail.
  const webviewUserAgent = useMemo(() => {
    if (!isElectronRuntime) return undefined
    return navigator.userAgent
      .replace(/\s*Electron\/[\d.]+/g, '')
      .replace(/\s*Thinking Space\/[\d.]+/g, '')
      .trim()
  }, [isElectronRuntime])

  const displayUrl = resolvedUrl ?? ''
  const [passwordSession, setPasswordSession] = useState(() => getPasswordVaultSessionSnapshotOrch())
  const [passwordAutofillContext, setPasswordAutofillContext] = useState<PasswordAutofillWebContextBlock | null>(null)
  const [passwordAutofillUnlockInput, setPasswordAutofillUnlockInput] = useState('')
  const [passwordAutofillBusyAction, setPasswordAutofillBusyAction] = useState<'unlock' | 'fill' | 'save' | null>(null)
  const [passwordAutofillError, setPasswordAutofillError] = useState<string | null>(null)
  const displayTitle = useMemo(() => {
    try { return new URL(displayUrl).hostname }
    catch { return 'Website' }
  }, [displayUrl])
  const passwordAutofillEnabled = isElectronRuntime && isTrusted && !suspended
  const passwordAutofillMatches = useMemo(
    () => passwordAutofillContext && passwordSession.vaultState
      ? findMatchingPasswordEntriesBlock(passwordSession.vaultState.vault.entries, passwordAutofillContext)
      : [],
    [passwordAutofillContext, passwordSession.vaultState],
  )
  const passwordAutofillSaveTarget = useMemo(
    () => passwordAutofillContext && passwordSession.vaultState
      ? findPasswordSaveTargetBlock(passwordSession.vaultState.vault.entries, passwordAutofillContext)
      : null,
    [passwordAutofillContext, passwordSession.vaultState],
  )
  const passwordAutofillCanSave = Boolean(
    passwordSession.unlocked
    && passwordAutofillContext
    && passwordAutofillContext.passwordValue.trim(),
  )
  const passwordAutofillStyle = useMemo(() => {
    const containerWidth = contentAreaRef.current?.clientWidth ?? 0
    const containerHeight = contentAreaRef.current?.clientHeight ?? 0
    const cardWidth = 320
    const cardHeight = passwordSession.unlocked ? 260 : 220
    const fallbackLeft = 16
    const fallbackTop = 16
    const rect = passwordAutofillContext?.rect
    if (!rect || containerWidth <= 0 || containerHeight <= 0) {
      return { left: fallbackLeft, top: fallbackTop }
    }
    const maxLeft = Math.max(fallbackLeft, containerWidth - cardWidth - 12)
    const maxTop = Math.max(fallbackTop, containerHeight - cardHeight - 12)
    return {
      left: Math.min(Math.max(rect.left, fallbackLeft), maxLeft),
      top: Math.min(Math.max(rect.bottom + 10, fallbackTop), maxTop),
    }
  }, [passwordAutofillContext, passwordSession.unlocked])

  const getElectronWebviewBlock = useCallback((): ElectronWebviewElementBlock | null => {
    if (!isElectronRuntime) return null
    return webviewRef.current as ElectronWebviewElementBlock | null
  }, [isElectronRuntime])

  useEffect(() => subscribePasswordVaultSessionOrch(setPasswordSession), [])

  // iOS: close the native WKWebView immediately (before paint) when suspended so
  // it doesn't bleed over overlays/drawers that open on top of the content area.
  useLayoutEffect(() => {
    if (!isCapacitorRuntime || !isTrusted || !resolvedUrl || !suspended) return
    void closeInlineWebViewBlock()
  }, [isCapacitorRuntime, isTrusted, resolvedUrl, suspended])

  // iOS: overlay a native WKWebView over the content area div, kept in sync
  // via ResizeObserver so it survives panel resizes and layout changes.
  useEffect(() => {
    if (!isCapacitorRuntime || !isTrusted || !resolvedUrl || suspended) return
    const el = contentAreaRef.current
    if (!el) return

    const getRect = () => el.getBoundingClientRect()

    void openInlineWebViewBlock(resolvedUrl, getRect())

    const observer = new ResizeObserver(() => {
      void updateInlineWebViewFrameBlock(getRect())
    })
    observer.observe(el)

    return () => {
      observer.disconnect()
      void closeInlineWebViewBlock()
    }
  }, [isCapacitorRuntime, isTrusted, resolvedUrl, suspended])

  // Webview back-state tracking (Electron only)
  useEffect(() => {
    setCanGoBack(false)
  }, [resolvedUrl])

  useEffect(() => {
    if (!isElectronRuntime || !isTrusted) return
    const webview = getElectronWebviewBlock()
    if (!webview) return

    const updateCanGoBack = () => {
      setCanGoBack(Boolean(webview.canGoBack?.()))
    }

    webview.addEventListener('did-navigate', updateCanGoBack)
    webview.addEventListener('did-navigate-in-page', updateCanGoBack)
    webview.addEventListener('did-finish-load', updateCanGoBack as EventListener)
    return () => {
      webview.removeEventListener('did-navigate', updateCanGoBack)
      webview.removeEventListener('did-navigate-in-page', updateCanGoBack)
      webview.removeEventListener('did-finish-load', updateCanGoBack as EventListener)
    }
  }, [getElectronWebviewBlock, isElectronRuntime, isTrusted])

  // macOS 2-finger swipe gesture forwarded from BrowserWindow 'swipe' event
  useEffect(() => {
    if (!isElectronRuntime) return
    const cleanup = (window.electronAPI as unknown as {
      onWebviewSwipe?: (cb: (dir: 'left' | 'right') => void) => () => void
    })?.onWebviewSwipe?.((direction) => {
      const wv = getElectronWebviewBlock()
      if (direction === 'left') wv?.goBack?.()
      else wv?.goForward?.()
    })
    return cleanup
  }, [getElectronWebviewBlock, isElectronRuntime])

  const handleGoBack = useCallback(() => {
    getElectronWebviewBlock()?.goBack?.()
  }, [getElectronWebviewBlock])

  const handleReload = useCallback(() => {
    if (isElectronRuntime) {
      getElectronWebviewBlock()?.reload?.()
    } else {
      setReloadKey(k => k + 1)
    }
  }, [getElectronWebviewBlock, isElectronRuntime])

  useEffect(() => {
    if (!passwordAutofillEnabled) {
      setPasswordAutofillContext(null)
      setPasswordAutofillError(null)
      return
    }

    let cancelled = false
    const probe = async () => {
      const webview = getElectronWebviewBlock()
      if (!webview?.executeJavaScript || passwordProbeInFlightRef.current) return
      passwordProbeInFlightRef.current = true
      try {
        const context = await probePasswordAutofillContextBlock(webview)
        if (!cancelled) {
          setPasswordAutofillContext(context)
        }
      } catch {
        if (!cancelled) {
          setPasswordAutofillContext(null)
        }
      } finally {
        passwordProbeInFlightRef.current = false
      }
    }

    const intervalId = window.setInterval(() => { void probe() }, 700)
    const webview = getElectronWebviewBlock()
    const handleLoad = () => {
      setPasswordAutofillError(null)
      void probe()
    }
    webview?.addEventListener('did-finish-load', handleLoad as EventListener)
    webview?.addEventListener('did-navigate-in-page', handleLoad as EventListener)
    void probe()

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      webview?.removeEventListener('did-finish-load', handleLoad as EventListener)
      webview?.removeEventListener('did-navigate-in-page', handleLoad as EventListener)
    }
  }, [getElectronWebviewBlock, passwordAutofillEnabled, resolvedUrl])

  const handlePasswordAutofillUnlock = useCallback(async () => {
    const normalized = passwordAutofillUnlockInput.trim()
    if (!normalized) {
      setPasswordAutofillError('Enter your password vault passphrase.')
      return
    }
    setPasswordAutofillBusyAction('unlock')
    setPasswordAutofillError(null)
    try {
      await unlockPasswordVaultSessionOrch(normalized)
      setPasswordAutofillUnlockInput('')
    } catch (err) {
      setPasswordAutofillError(err instanceof Error ? err.message : 'Failed to unlock passwords.')
    } finally {
      setPasswordAutofillBusyAction(null)
    }
  }, [passwordAutofillUnlockInput])

  const handlePasswordAutofillFill = useCallback(async (entry: PasswordVaultEntryBlock) => {
    const webview = getElectronWebviewBlock()
    if (!webview?.executeJavaScript) return
    setPasswordAutofillBusyAction('fill')
    setPasswordAutofillError(null)
    try {
      const result = await webview.executeJavaScript(
        buildPasswordAutofillFillScriptBlock({
          username: entry.username,
          password: entry.password,
        }),
        true,
      )
      if (!result) {
        throw new Error('Could not fill the active login form.')
      }
    } catch (err) {
      setPasswordAutofillError(err instanceof Error ? err.message : 'Failed to fill saved password.')
    } finally {
      setPasswordAutofillBusyAction(null)
    }
  }, [getElectronWebviewBlock])

  const handlePasswordAutofillSave = useCallback(async () => {
    if (!passwordSession.vaultState || !passwordAutofillContext) return
    const password = passwordAutofillContext.passwordValue.trim()
    if (!password) {
      setPasswordAutofillError('Type a password in the site first.')
      return
    }

    const now = new Date().toISOString()
    const existing = passwordAutofillSaveTarget
    const nextEntry: PasswordVaultEntryBlock = {
      id: existing?.id ?? createPasswordVaultEntryIdOrch(),
      title: existing?.title ?? derivePasswordEntryTitleBlock(
        passwordAutofillContext.pageTitle,
        passwordAutofillContext.hostname,
      ),
      username: passwordAutofillContext.usernameValue.trim(),
      password,
      website: passwordAutofillContext.origin || passwordAutofillContext.url,
      notes: existing?.notes,
      tags: existing?.tags ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    const nextEntries = existing
      ? passwordSession.vaultState.vault.entries.map((entry) => entry.id === existing.id ? nextEntry : entry)
      : [nextEntry, ...passwordSession.vaultState.vault.entries]

    setPasswordAutofillBusyAction('save')
    setPasswordAutofillError(null)
    try {
      await savePasswordVaultSessionVaultOrch({
        ...passwordSession.vaultState.vault,
        updatedAt: now,
        entries: nextEntries,
      })
    } catch (err) {
      setPasswordAutofillError(err instanceof Error ? err.message : 'Failed to save password.')
    } finally {
      setPasswordAutofillBusyAction(null)
    }
  }, [passwordAutofillContext, passwordAutofillSaveTarget, passwordSession.vaultState])

  const openExternal = useCallback(() => {
    if (!resolvedUrl) return
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(resolvedUrl)
    } else {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
    }
  }, [resolvedUrl])

  if (loading) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !isTrusted) {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-3 p-8', className)}>
        <Globe className="h-8 w-8 text-muted-foreground/50" />
        <div className="text-sm text-destructive">{error ?? 'Invalid or unsupported URL.'}</div>
        {showCloseButton && onClose && (
          <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* URL bar */}
      {!hideHeader && (
        <div className="ts-doc-header flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2">
          {isElectronRuntime && (
            <button
              type="button"
              onClick={handleGoBack}
              disabled={!canGoBack}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
              title="Go back"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <Globe className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{displayUrl}</span>
          <button
            type="button"
            onClick={handleReload}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            title="Reload"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={openExternal}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            title="Open in external browser"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Content area */}
      <div ref={contentAreaRef} className="relative min-h-0 flex-1 overflow-hidden">
        {isElectronRuntime ? (
          <webview
            ref={webviewRef}
            title={displayTitle}
            src={resolvedUrl!}
            partition={partition ?? LINK_WEBVIEW_PARTITION}
            useragent={webviewUserAgent}
            // Spotify relies on Widevine/EME, which Electron only exposes to
            // guest content when browser plugins are explicitly enabled.
            plugins
            allowpopups
            className="absolute inset-0 bg-background"
          />
        ) : isCapacitorRuntime ? (
          // Native WKWebView is overlaid by the plugin — render a transparent
          // placeholder so the React layout reserves the same space.
          <div className="absolute inset-0" />
        ) : (
          <iframe
            key={reloadKey}
            title={displayTitle}
            src={resolvedUrl!}
            className="absolute inset-0 bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
        {passwordAutofillEnabled && passwordAutofillContext && (
          <div className="pointer-events-none absolute inset-0 z-20">
            <div
              className="pointer-events-auto absolute"
              style={{
                left: `${passwordAutofillStyle.left}px`,
                top: `${passwordAutofillStyle.top}px`,
              }}
            >
              <PasswordAutofillOverlayBlock
                hostname={passwordAutofillContext.hostname || displayTitle}
                locked={!passwordSession.unlocked}
                unlockPassphrase={passwordAutofillUnlockInput}
                onUnlockPassphraseChange={setPasswordAutofillUnlockInput}
                onUnlock={() => { void handlePasswordAutofillUnlock() }}
                unlocking={passwordAutofillBusyAction === 'unlock'}
                matches={passwordAutofillMatches}
                onFill={(entry) => { void handlePasswordAutofillFill(entry) }}
                filling={passwordAutofillBusyAction === 'fill'}
                canSave={passwordAutofillCanSave}
                saveLabel={passwordAutofillSaveTarget ? 'Update' : 'Save'}
                onSave={() => { void handlePasswordAutofillSave() }}
                saving={passwordAutofillBusyAction === 'save'}
                onOpenManager={() => navigate('/password-manager')}
                usernameValue={passwordAutofillContext.usernameValue}
                error={passwordAutofillError}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(UrlDocumentBlock)
