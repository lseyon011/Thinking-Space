// Workspace tabs + persistent surface orchestrator.
//
// Owns the cluster of state that drives the app-shell tab strip and the
// per-route "persistent surface" mounts (chat / web / organizer / thinking
// space). Previously inlined in App.tsx — extracted to (a) shrink the
// 3700-line App.tsx, (b) move the open/close/switch/persistence transitions
// into a single reducer so re-render risk lives in one place, and (c) make
// the tab cluster testable on its own.
//
// One reducer owns every slice that participates in coupled transitions
// (close-tab must reposition activeId AND prune persistent slices). useState
// is kept only for state that's genuinely orthogonal — there is none here.
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  type AppWorkspaceTab,
  appendPersistentSurfaceTabId,
  applyPersistentSurfaceBudget,
  createWorkspaceTabId,
  getTabLabel,
  getWindowScopedAppShellActiveTabStorageKey,
  getWindowScopedAppShellTabsStorageKey,
  normalizeTabRoute,
  parseTabRoute,
  readScopedAppShellActiveTabIdBlock,
  readScopedAppShellTabsBlock,
  resolvePreferredSameRouteTabLabel,
  sameTabIdSequence,
  setDynamicStorageItemBlock,
} from '../../services/lego_blocks/integrations/workspaceTabsBlock'
import type { WindowContextBlock } from '../../services/lego_blocks/units/windowContextBlock'
import { perfTraceEnabled } from '../../services/lego_blocks/units/perfTraceBlock'

export const MAX_HIDDEN_PERSISTENT_CHAT_SURFACES = 1
export const MAX_HIDDEN_PERSISTENT_WEB_SURFACES = 1
export const MAX_HIDDEN_PERSISTENT_THINKING_SPACE_SURFACES = 2

export interface WorkspaceTabsPersistentMounts {
  organizer: boolean
  newThought: boolean
  thinkingSpace: boolean
  webull: boolean
}

export interface WorkspaceTabsState {
  workspaceTabs: AppWorkspaceTab[]
  activeWorkspaceTabId: string
  persistentChatTabIds: string[]
  persistentWebTabIds: string[]
  persistentWebSiteIdByTabId: Record<string, string | null>
  persistentThinkingSpaceTabIds: string[]
  persistentOrganizerRouteByTabId: Record<string, string>
  persistentRouteMounts: WorkspaceTabsPersistentMounts
}

type Action =
  | { type: 'setTabs'; tabs: AppWorkspaceTab[] }
  | { type: 'appendTab'; tab: AppWorkspaceTab }
  | { type: 'removeTab'; tabId: string }
  | { type: 'setActiveTab'; tabId: string }
  | {
      type: 'syncActiveTabRoute'
      tabId: string
      normalizedCurrentRoute: string
      derivedLabel: string
      pendingTabId: string | null
      pendingRoute: string | null
    }
  | { type: 'setTabLabel'; tabId: string; label: string }
  | {
      type: 'recordChatSurface'
      tabId: string
      activeChatTabId: string | null
    }
  | {
      type: 'recordWebSurface'
      tabId: string
      activeWebTabId: string | null
      siteId?: string | null
      writeSiteId: boolean
    }
  | {
      type: 'recordThinkingSpaceSurface'
      tabId: string
      activeThinkingSpaceTabId: string | null
    }
  | { type: 'recordOrganizerRoute'; tabId: string; route: string }
  | {
      type: 'selectWebSite'
      tabId: string
      siteId: string
      activeWebTabId: string | null
    }
  | {
      type: 'pruneToTabs'
      tabIds: Set<string>
      activeChatTabId: string | null
      activeWebTabId: string | null
      activeThinkingSpaceTabId: string | null
    }
  | { type: 'mergeMounts'; flags: Partial<WorkspaceTabsPersistentMounts> }

function reducer(state: WorkspaceTabsState, action: Action): WorkspaceTabsState {
  switch (action.type) {
    case 'setTabs':
      return state.workspaceTabs === action.tabs ? state : { ...state, workspaceTabs: action.tabs }
    case 'appendTab':
      return {
        ...state,
        workspaceTabs: [...state.workspaceTabs, action.tab],
        activeWorkspaceTabId: action.tab.id,
      }
    case 'removeTab': {
      if (state.workspaceTabs.length <= 1) return state
      const closeIndex = state.workspaceTabs.findIndex(t => t.id === action.tabId)
      if (closeIndex === -1) return state
      const nextTabs = state.workspaceTabs.filter(t => t.id !== action.tabId)
      if (action.tabId !== state.activeWorkspaceTabId) {
        return { ...state, workspaceTabs: nextTabs }
      }
      const nextActive = nextTabs[Math.max(0, closeIndex - 1)] ?? nextTabs[0]
      if (!nextActive) return { ...state, workspaceTabs: nextTabs }
      return {
        ...state,
        workspaceTabs: nextTabs,
        activeWorkspaceTabId: nextActive.id,
      }
    }
    case 'setActiveTab':
      return state.activeWorkspaceTabId === action.tabId
        ? state
        : { ...state, activeWorkspaceTabId: action.tabId }
    case 'syncActiveTabRoute': {
      const index = state.workspaceTabs.findIndex(t => t.id === action.tabId)
      if (index === -1) return state
      if (action.pendingTabId !== null) {
        if (action.tabId !== action.pendingTabId) return state
        if (action.normalizedCurrentRoute !== action.pendingRoute) return state
      }
      const current = state.workspaceTabs[index]
      const pathname = parseTabRoute(action.normalizedCurrentRoute).pathname
      const prevPathname = parseTabRoute(current.route).pathname
      const nextLabel = (pathname === '/ai/chat' || pathname === '/web') && prevPathname === pathname
        ? resolvePreferredSameRouteTabLabel(pathname, current.label, action.derivedLabel)
        : action.derivedLabel
      if (current.route === action.normalizedCurrentRoute && current.label === nextLabel) return state
      const nextTabs = state.workspaceTabs.slice()
      nextTabs[index] = { ...current, route: action.normalizedCurrentRoute, label: nextLabel }
      return { ...state, workspaceTabs: nextTabs }
    }
    case 'setTabLabel': {
      const index = state.workspaceTabs.findIndex(t => t.id === action.tabId)
      if (index === -1) return state
      if (state.workspaceTabs[index].label === action.label) return state
      const nextTabs = state.workspaceTabs.slice()
      nextTabs[index] = { ...nextTabs[index], label: action.label }
      return { ...state, workspaceTabs: nextTabs }
    }
    case 'recordChatSurface': {
      const next = appendPersistentSurfaceTabId(
        state.persistentChatTabIds,
        action.tabId,
        MAX_HIDDEN_PERSISTENT_CHAT_SURFACES,
        action.activeChatTabId,
      )
      return sameTabIdSequence(next, state.persistentChatTabIds)
        ? state
        : { ...state, persistentChatTabIds: next }
    }
    case 'recordWebSurface': {
      const next = appendPersistentSurfaceTabId(
        state.persistentWebTabIds,
        action.tabId,
        MAX_HIDDEN_PERSISTENT_WEB_SURFACES,
        action.activeWebTabId,
      )
      const nextState = sameTabIdSequence(next, state.persistentWebTabIds)
        ? state
        : { ...state, persistentWebTabIds: next }
      if (!action.writeSiteId) return nextState
      const prev = nextState.persistentWebSiteIdByTabId
      if (prev[action.tabId] === (action.siteId ?? null)) return nextState
      return {
        ...nextState,
        persistentWebSiteIdByTabId: { ...prev, [action.tabId]: action.siteId ?? null },
      }
    }
    case 'recordThinkingSpaceSurface': {
      const next = appendPersistentSurfaceTabId(
        state.persistentThinkingSpaceTabIds,
        action.tabId,
        MAX_HIDDEN_PERSISTENT_THINKING_SPACE_SURFACES,
        action.activeThinkingSpaceTabId,
      )
      return sameTabIdSequence(next, state.persistentThinkingSpaceTabIds)
        ? state
        : { ...state, persistentThinkingSpaceTabIds: next }
    }
    case 'recordOrganizerRoute': {
      const prev = state.persistentOrganizerRouteByTabId
      if (prev[action.tabId] === action.route) return state
      return {
        ...state,
        persistentOrganizerRouteByTabId: { ...prev, [action.tabId]: action.route },
      }
    }
    case 'selectWebSite': {
      const nextIds = appendPersistentSurfaceTabId(
        state.persistentWebTabIds,
        action.tabId,
        MAX_HIDDEN_PERSISTENT_WEB_SURFACES,
        action.activeWebTabId,
      )
      const idsChanged = !sameTabIdSequence(nextIds, state.persistentWebTabIds)
      const siteChanged = state.persistentWebSiteIdByTabId[action.tabId] !== action.siteId
      if (!idsChanged && !siteChanged) return state
      return {
        ...state,
        persistentWebTabIds: idsChanged ? nextIds : state.persistentWebTabIds,
        persistentWebSiteIdByTabId: siteChanged
          ? { ...state.persistentWebSiteIdByTabId, [action.tabId]: action.siteId }
          : state.persistentWebSiteIdByTabId,
      }
    }
    case 'pruneToTabs': {
      const { tabIds, activeChatTabId, activeWebTabId, activeThinkingSpaceTabId } = action
      const prunedChat = applyPersistentSurfaceBudget(
        state.persistentChatTabIds.filter(id => tabIds.has(id)),
        MAX_HIDDEN_PERSISTENT_CHAT_SURFACES,
        activeChatTabId,
      )
      const prunedWeb = applyPersistentSurfaceBudget(
        state.persistentWebTabIds.filter(id => tabIds.has(id)),
        MAX_HIDDEN_PERSISTENT_WEB_SURFACES,
        activeWebTabId,
      )
      const prunedTs = applyPersistentSurfaceBudget(
        state.persistentThinkingSpaceTabIds.filter(id => tabIds.has(id)),
        MAX_HIDDEN_PERSISTENT_THINKING_SPACE_SURFACES,
        activeThinkingSpaceTabId,
      )
      const siteEntries = Object.entries(state.persistentWebSiteIdByTabId).filter(([id]) => tabIds.has(id))
      const orgEntries = Object.entries(state.persistentOrganizerRouteByTabId).filter(([id]) => tabIds.has(id))
      const chatChanged = !sameTabIdSequence(prunedChat, state.persistentChatTabIds)
      const webChanged = !sameTabIdSequence(prunedWeb, state.persistentWebTabIds)
      const tsChanged = !sameTabIdSequence(prunedTs, state.persistentThinkingSpaceTabIds)
      const siteChanged = siteEntries.length !== Object.keys(state.persistentWebSiteIdByTabId).length
      const orgChanged = orgEntries.length !== Object.keys(state.persistentOrganizerRouteByTabId).length
      if (!chatChanged && !webChanged && !tsChanged && !siteChanged && !orgChanged) return state
      return {
        ...state,
        persistentChatTabIds: chatChanged ? prunedChat : state.persistentChatTabIds,
        persistentWebTabIds: webChanged ? prunedWeb : state.persistentWebTabIds,
        persistentThinkingSpaceTabIds: tsChanged ? prunedTs : state.persistentThinkingSpaceTabIds,
        persistentWebSiteIdByTabId: siteChanged ? Object.fromEntries(siteEntries) as Record<string, string | null> : state.persistentWebSiteIdByTabId,
        persistentOrganizerRouteByTabId: orgChanged ? Object.fromEntries(orgEntries) as Record<string, string> : state.persistentOrganizerRouteByTabId,
      }
    }
    case 'mergeMounts': {
      const cur = state.persistentRouteMounts
      const next: WorkspaceTabsPersistentMounts = {
        organizer: cur.organizer || Boolean(action.flags.organizer),
        newThought: cur.newThought || Boolean(action.flags.newThought),
        thinkingSpace: cur.thinkingSpace || Boolean(action.flags.thinkingSpace),
        webull: cur.webull || Boolean(action.flags.webull),
      }
      if (
        next.organizer === cur.organizer
        && next.newThought === cur.newThought
        && next.thinkingSpace === cur.thinkingSpace
        && next.webull === cur.webull
      ) return state
      return { ...state, persistentRouteMounts: next }
    }
    default:
      return state
  }
}

function buildInitialState(
  windowContext: WindowContextBlock,
  initialRoute: string,
  initialPathname: string,
): WorkspaceTabsState {
  const savedTabs = readScopedAppShellTabsBlock(windowContext)
    .filter(c => (
      !!c
      && typeof c.id === 'string'
      && typeof c.route === 'string'
      && c.id.trim().length > 0
      && c.route.trim().length > 0
    ))
    .slice(0, 24)
    .map(c => ({
      id: c.id.trim(),
      route: normalizeTabRoute(c.route),
      label: typeof c.label === 'string' && c.label.trim().length > 0 ? c.label.trim() : undefined,
    }))
  const workspaceTabs = savedTabs.length > 0
    ? savedTabs
    : [{ id: createWorkspaceTabId(), route: normalizeTabRoute(initialRoute) }]
  const activeWorkspaceTabId = readScopedAppShellActiveTabIdBlock(windowContext)
  return {
    workspaceTabs,
    activeWorkspaceTabId,
    persistentChatTabIds: applyPersistentSurfaceBudget(
      workspaceTabs.filter(t => parseTabRoute(t.route).pathname === '/ai/chat').map(t => t.id),
      MAX_HIDDEN_PERSISTENT_CHAT_SURFACES,
    ),
    persistentWebTabIds: applyPersistentSurfaceBudget(
      workspaceTabs.filter(t => parseTabRoute(t.route).pathname === '/web').map(t => t.id),
      MAX_HIDDEN_PERSISTENT_WEB_SURFACES,
    ),
    persistentWebSiteIdByTabId: Object.fromEntries(
      workspaceTabs.map(t => {
        const parsed = parseTabRoute(t.route)
        return [t.id, parsed.pathname === '/web' ? parsed.search.get('site') : null]
      }),
    ),
    persistentThinkingSpaceTabIds: applyPersistentSurfaceBudget(
      workspaceTabs.filter(t => parseTabRoute(t.route).pathname === '/thinking-space').map(t => t.id),
      MAX_HIDDEN_PERSISTENT_THINKING_SPACE_SURFACES,
    ),
    persistentOrganizerRouteByTabId: Object.fromEntries(
      workspaceTabs.flatMap(t => {
        const pathname = parseTabRoute(t.route).pathname
        return pathname === '/thinking-organizer' || pathname === '/file-organizer'
          ? [[t.id, normalizeTabRoute(t.route)] as const]
          : []
      }),
    ),
    persistentRouteMounts: {
      organizer: initialPathname === '/thinking-organizer' || initialPathname === '/file-organizer',
      newThought: initialPathname === '/new-thought',
      thinkingSpace: initialPathname === '/thinking-space',
      webull: initialPathname === '/webull',
    },
  }
}

export interface WorkspaceTabsOrchInputs {
  windowContext: WindowContextBlock
  location: { pathname: string; search: string }
  currentRoute: string
  routeLabelByPath: Map<string, string>
  chatChromeLabel: string | undefined
  webChromeLabel: string | undefined
  webChromeSiteLabels: Record<string, string> | undefined
  webullTabLabel: string
}

export interface WorkspaceTabsOrchApi {
  // raw state
  workspaceTabs: AppWorkspaceTab[]
  activeWorkspaceTabId: string
  activeWorkspaceTab: AppWorkspaceTab | null
  persistentChatTabIds: string[]
  persistentWebTabIds: string[]
  persistentWebSiteIdByTabId: Record<string, string | null>
  persistentThinkingSpaceTabIds: string[]
  persistentOrganizerRouteByTabId: Record<string, string>
  persistentRouteMounts: WorkspaceTabsPersistentMounts
  mountedTabIdSet: Set<string>

  // route booleans (derived from location.pathname; kept here so they stay
  // in sync with the persistent-surface logic that reads them)
  isChatRoute: boolean
  isWebRoute: boolean
  isOrganizerRoute: boolean
  isNewThoughtRoute: boolean
  isThinkingSpaceRoute: boolean
  isWebullRoute: boolean
  usesPersistentRouteSurface: boolean

  // augmented surface arrays (always include active tab even before record effect runs)
  activeChatTabIds: string[]
  activeWebTabIds: string[]
  activeThinkingSpaceTabIds: string[]
  activeOrganizerRoute: string | null

  // labels
  activeWorkspaceTabDisplayRoute: string
  derivedActiveWorkspaceTabLabel: string
  activeWorkspaceTabLabel: string

  // refs (stable identity)
  pendingWorkspaceTabNavigationRef: React.MutableRefObject<{ tabId: string; route: string } | null>
  activeWorkspaceTabIdRef: React.MutableRefObject<string>
  tabSwitchPerfRef: React.MutableRefObject<{ tabId: string; label: string; route: string; clickAt: number } | null>

  // handlers
  handleCreateWorkspaceTab: () => void
  handleSelectWorkspaceTab: (tabId: string) => void
  handleCloseWorkspaceTab: (tabId: string) => void
  handlePersistentWebSiteSelect: (tabId: string, siteId: string) => void
  getWebSiteSelectCallback: (tabId: string) => (siteId: string) => void
  syncActiveWorkspaceTabLabel: (pathname: string, nextLabel: string) => void
}

export function useWorkspaceTabsOrch(inputs: WorkspaceTabsOrchInputs): WorkspaceTabsOrchApi {
  const {
    windowContext,
    location,
    currentRoute,
    routeLabelByPath,
    chatChromeLabel,
    webChromeLabel,
    webChromeSiteLabels,
    webullTabLabel,
  } = inputs

  const navigate = useNavigate()

  const initialContextRef = useRef(windowContext)
  const initialRouteRef = useRef(currentRoute)
  const initialPathnameRef = useRef(location.pathname)

  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => buildInitialState(initialContextRef.current, initialRouteRef.current, initialPathnameRef.current),
  )

  const {
    workspaceTabs,
    activeWorkspaceTabId,
    persistentChatTabIds,
    persistentWebTabIds,
    persistentWebSiteIdByTabId,
    persistentThinkingSpaceTabIds,
    persistentOrganizerRouteByTabId,
    persistentRouteMounts,
  } = state

  const pendingWorkspaceTabNavigationRef = useRef<{ tabId: string; route: string } | null>(null)
  const activeWorkspaceTabIdRef = useRef(activeWorkspaceTabId)
  const currentRouteRef = useRef(currentRoute)
  const tabSwitchPerfRef = useRef<{ tabId: string; label: string; route: string; clickAt: number } | null>(null)

  // Derived route flags
  const pathname = location.pathname
  const isChatRoute = pathname === '/ai/chat'
  const isWebRoute = pathname === '/web'
  const isOrganizerRoute = pathname === '/thinking-organizer' || pathname === '/file-organizer'
  const isNewThoughtRoute = pathname === '/new-thought'
  const isThinkingSpaceRoute = pathname === '/thinking-space'
  const isWebullRoute = pathname === '/webull'
  const usesPersistentRouteSurface = isChatRoute || isWebRoute || isOrganizerRoute || isNewThoughtRoute || isThinkingSpaceRoute || isWebullRoute

  const appShellTabsStorageKey = useMemo(
    () => getWindowScopedAppShellTabsStorageKey(windowContext),
    [windowContext],
  )
  const appShellActiveTabStorageKey = useMemo(
    () => getWindowScopedAppShellActiveTabStorageKey(windowContext),
    [windowContext],
  )

  const mountedTabIdSet = useMemo(
    () => new Set(workspaceTabs.map(t => t.id)),
    [workspaceTabs],
  )

  const activeWorkspaceTab = useMemo(
    () => workspaceTabs.find(t => t.id === activeWorkspaceTabId) ?? null,
    [activeWorkspaceTabId, workspaceTabs],
  )

  useEffect(() => {
    activeWorkspaceTabIdRef.current = activeWorkspaceTabId
    currentRouteRef.current = currentRoute
  }, [activeWorkspaceTabId, currentRoute])

  const activeWorkspaceTabDisplayRoute = useMemo(() => {
    const pending = pendingWorkspaceTabNavigationRef.current
    if (pending && pending.tabId === activeWorkspaceTabId) return pending.route
    return currentRoute
  }, [activeWorkspaceTabId, currentRoute])

  const derivedActiveWorkspaceTabLabel = useMemo(
    () => getTabLabel(
      activeWorkspaceTabDisplayRoute,
      routeLabelByPath,
      chatChromeLabel,
      webChromeLabel,
      webullTabLabel,
      webChromeSiteLabels,
    ),
    [
      activeWorkspaceTabDisplayRoute,
      routeLabelByPath,
      chatChromeLabel,
      webChromeLabel,
      webullTabLabel,
      webChromeSiteLabels,
    ],
  )

  const activeWorkspaceTabLabel = useMemo(
    () => resolvePreferredSameRouteTabLabel(
      parseTabRoute(activeWorkspaceTabDisplayRoute).pathname,
      activeWorkspaceTab?.label,
      derivedActiveWorkspaceTabLabel,
    ),
    [activeWorkspaceTab?.label, activeWorkspaceTabDisplayRoute, derivedActiveWorkspaceTabLabel],
  )

  // Augmented surface arrays — include active tab eagerly while the record
  // effect catches up. Mirrors the inline useMemos from the previous App.tsx.
  const activeChatTabIds = useMemo(
    () => (isChatRoute && activeWorkspaceTabId && !persistentChatTabIds.includes(activeWorkspaceTabId)
      ? [...persistentChatTabIds, activeWorkspaceTabId]
      : persistentChatTabIds),
    [activeWorkspaceTabId, isChatRoute, persistentChatTabIds],
  )
  const activeWebTabIds = useMemo(
    () => (isWebRoute && activeWorkspaceTabId && !persistentWebTabIds.includes(activeWorkspaceTabId)
      ? [...persistentWebTabIds, activeWorkspaceTabId]
      : persistentWebTabIds),
    [activeWorkspaceTabId, isWebRoute, persistentWebTabIds],
  )
  const activeThinkingSpaceTabIds = useMemo(
    () => (isThinkingSpaceRoute && activeWorkspaceTabId && !persistentThinkingSpaceTabIds.includes(activeWorkspaceTabId)
      ? [...persistentThinkingSpaceTabIds, activeWorkspaceTabId]
      : persistentThinkingSpaceTabIds),
    [activeWorkspaceTabId, isThinkingSpaceRoute, persistentThinkingSpaceTabIds],
  )
  const activeOrganizerRoute = useMemo(
    () => (activeWorkspaceTabId
      ? (persistentOrganizerRouteByTabId[activeWorkspaceTabId] ?? '/thinking-organizer')
      : null),
    [activeWorkspaceTabId, persistentOrganizerRouteByTabId],
  )

  // Route-driven side effect: keep persistentRouteMounts sticky-on, append the
  // current tab to whichever route's persistent-surface list, and record the
  // organizer per-tab route. Mirrors the inline effect at App.tsx:1660.
  useEffect(() => {
    dispatch({
      type: 'mergeMounts',
      flags: {
        organizer: isOrganizerRoute,
        newThought: isNewThoughtRoute,
        thinkingSpace: isThinkingSpaceRoute,
        webull: isWebullRoute,
      },
    })
    if (!activeWorkspaceTabId) return
    const normalizedCurrentRoute = normalizeTabRoute(currentRoute)
    const pending = pendingWorkspaceTabNavigationRef.current
    const activeTabRoutePending = pending?.tabId === activeWorkspaceTabId
      && pending.route !== normalizedCurrentRoute

    if (isChatRoute) {
      dispatch({ type: 'recordChatSurface', tabId: activeWorkspaceTabId, activeChatTabId: activeWorkspaceTabId })
    }
    if (isWebRoute) {
      const selectedSiteId = new URLSearchParams(location.search).get('site')
      dispatch({
        type: 'recordWebSurface',
        tabId: activeWorkspaceTabId,
        activeWebTabId: activeWorkspaceTabId,
        siteId: selectedSiteId,
        writeSiteId: !activeTabRoutePending && selectedSiteId !== null,
      })
    }
    if (isThinkingSpaceRoute) {
      dispatch({
        type: 'recordThinkingSpaceSurface',
        tabId: activeWorkspaceTabId,
        activeThinkingSpaceTabId: activeWorkspaceTabId,
      })
    }
    if (isOrganizerRoute) {
      if (activeTabRoutePending) return
      dispatch({ type: 'recordOrganizerRoute', tabId: activeWorkspaceTabId, route: normalizedCurrentRoute })
    }
  }, [activeWorkspaceTabId, currentRoute, isChatRoute, isNewThoughtRoute, isOrganizerRoute, isThinkingSpaceRoute, isWebRoute, isWebullRoute, location.search])

  // Fallback-tab + reactivate-on-vanished-active effect (was App.tsx:2410).
  useEffect(() => {
    if (workspaceTabs.length === 0) {
      const fallbackTab: AppWorkspaceTab = {
        id: createWorkspaceTabId(),
        route: normalizeTabRoute(currentRoute),
      }
      dispatch({ type: 'setTabs', tabs: [fallbackTab] })
      dispatch({ type: 'setActiveTab', tabId: fallbackTab.id })
      return
    }
    if (activeWorkspaceTabId && workspaceTabs.some(t => t.id === activeWorkspaceTabId)) return
    const matchingRouteTab = workspaceTabs.find(t => t.route === normalizeTabRoute(currentRoute))
    dispatch({ type: 'setActiveTab', tabId: (matchingRouteTab ?? workspaceTabs[0]).id })
  }, [activeWorkspaceTabId, currentRoute, workspaceTabs])

  // Per-tab stable web-site-select callbacks. Indirection via ref keeps each
  // tab's callback identity fixed across renders (the memoized Web surface
  // depends on this for re-render isolation). Declared before the prune
  // effect so the GC loop has the ref to walk.
  const handlePersistentWebSiteSelectRef = useRef<(tabId: string, siteId: string) => void>(() => {})
  const webSiteSelectCallbackByTabIdRef = useRef(new Map<string, (siteId: string) => void>())

  // Prune persistent slices to current tab set (was App.tsx:2425).
  useEffect(() => {
    const tabIds = new Set(workspaceTabs.map(t => t.id))
    for (const tabId of webSiteSelectCallbackByTabIdRef.current.keys()) {
      if (!tabIds.has(tabId)) webSiteSelectCallbackByTabIdRef.current.delete(tabId)
    }
    dispatch({
      type: 'pruneToTabs',
      tabIds,
      activeChatTabId: isChatRoute ? activeWorkspaceTabId : null,
      activeWebTabId: isWebRoute ? activeWorkspaceTabId : null,
      activeThinkingSpaceTabId: isThinkingSpaceRoute ? activeWorkspaceTabId : null,
    })
  }, [activeWorkspaceTabId, isChatRoute, isThinkingSpaceRoute, isWebRoute, workspaceTabs])

  // Sync active tab's route + label whenever currentRoute settles (was App.tsx:2464).
  useEffect(() => {
    if (!activeWorkspaceTabId) return
    const pending = pendingWorkspaceTabNavigationRef.current
    dispatch({
      type: 'syncActiveTabRoute',
      tabId: activeWorkspaceTabId,
      normalizedCurrentRoute: normalizeTabRoute(currentRoute),
      derivedLabel: derivedActiveWorkspaceTabLabel,
      pendingTabId: pending?.tabId ?? null,
      pendingRoute: pending?.route ?? null,
    })
  }, [activeWorkspaceTabId, currentRoute, derivedActiveWorkspaceTabLabel])

  // Pending navigation resolver — once the active tab matches the pending
  // route OR the pending tab is gone, clear the ref (was App.tsx:2487).
  useEffect(() => {
    const pending = pendingWorkspaceTabNavigationRef.current
    if (!pending) return
    if (activeWorkspaceTabId !== pending.tabId) return
    if (!workspaceTabs.some(t => t.id === pending.tabId)) {
      pendingWorkspaceTabNavigationRef.current = null
      return
    }
    const normalizedCurrentRoute = normalizeTabRoute(currentRoute)
    if (normalizedCurrentRoute !== pending.route) {
      navigate(pending.route)
      return
    }
    pendingWorkspaceTabNavigationRef.current = null
  }, [activeWorkspaceTabId, currentRoute, navigate, workspaceTabs])

  // Debounced persistence: tabs (was App.tsx:2507).
  const tabsPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (tabsPersistTimerRef.current) clearTimeout(tabsPersistTimerRef.current)
    tabsPersistTimerRef.current = setTimeout(() => {
      tabsPersistTimerRef.current = null
      setDynamicStorageItemBlock(appShellTabsStorageKey, JSON.stringify(workspaceTabs))
    }, 500)
    return () => { if (tabsPersistTimerRef.current) clearTimeout(tabsPersistTimerRef.current) }
  }, [appShellTabsStorageKey, workspaceTabs])

  // Debounced persistence: active tab id (was App.tsx:2517).
  const activeTabPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!activeWorkspaceTabId) return
    if (activeTabPersistTimerRef.current) clearTimeout(activeTabPersistTimerRef.current)
    activeTabPersistTimerRef.current = setTimeout(() => {
      activeTabPersistTimerRef.current = null
      setDynamicStorageItemBlock(appShellActiveTabStorageKey, activeWorkspaceTabId)
    }, 300)
    return () => { if (activeTabPersistTimerRef.current) clearTimeout(activeTabPersistTimerRef.current) }
  }, [activeWorkspaceTabId, appShellActiveTabStorageKey])

  // Flush debounced writes on pagehide / visibilitychange (was App.tsx:2530).
  useEffect(() => {
    const flush = () => {
      if (tabsPersistTimerRef.current) {
        clearTimeout(tabsPersistTimerRef.current)
        tabsPersistTimerRef.current = null
        setDynamicStorageItemBlock(appShellTabsStorageKey, JSON.stringify(workspaceTabs))
      }
      if (activeTabPersistTimerRef.current) {
        clearTimeout(activeTabPersistTimerRef.current)
        activeTabPersistTimerRef.current = null
        if (activeWorkspaceTabId) {
          setDynamicStorageItemBlock(appShellActiveTabStorageKey, activeWorkspaceTabId)
        }
      }
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [activeWorkspaceTabId, appShellActiveTabStorageKey, appShellTabsStorageKey, workspaceTabs])

  // External "open route in new tab" event (was App.tsx:2553).
  useEffect(() => {
    const onOpenRouteInNewTab = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      const route = normalizeTabRoute(customEvent.detail ?? '/')
      const tab: AppWorkspaceTab = { id: createWorkspaceTabId(), route }
      pendingWorkspaceTabNavigationRef.current = { tabId: tab.id, route }
      dispatch({ type: 'appendTab', tab })
    }
    window.addEventListener('ltm:workspace-open-route-in-new-tab', onOpenRouteInNewTab as EventListener)
    return () => {
      window.removeEventListener('ltm:workspace-open-route-in-new-tab', onOpenRouteInNewTab as EventListener)
    }
  }, [])

  // Handlers
  const handleCreateWorkspaceTab = useCallback(() => {
    const tab: AppWorkspaceTab = { id: createWorkspaceTabId(), route: '/' }
    pendingWorkspaceTabNavigationRef.current = { tabId: tab.id, route: normalizeTabRoute(tab.route) }
    dispatch({ type: 'appendTab', tab })
    navigate(tab.route)
  }, [navigate])

  const handleSelectWorkspaceTab = useCallback((tabId: string) => {
    if (tabId === activeWorkspaceTabId) return
    const target = workspaceTabs.find(t => t.id === tabId)
    if (!target) return
    if (perfTraceEnabled()) {
      tabSwitchPerfRef.current = {
        tabId,
        label: target.label ?? tabId,
        route: target.route,
        clickAt: performance.now(),
      }
    }
    if (target.route !== currentRoute) {
      pendingWorkspaceTabNavigationRef.current = {
        tabId,
        route: normalizeTabRoute(target.route),
      }
    } else if (pendingWorkspaceTabNavigationRef.current?.tabId === tabId) {
      pendingWorkspaceTabNavigationRef.current = null
    }
    dispatch({ type: 'setActiveTab', tabId })
    if (target.route !== currentRoute) {
      navigate(target.route)
    }
  }, [activeWorkspaceTabId, currentRoute, navigate, workspaceTabs])

  const handleCloseWorkspaceTab = useCallback((tabId: string) => {
    if (workspaceTabs.length <= 1) return
    if (pendingWorkspaceTabNavigationRef.current?.tabId === tabId) {
      pendingWorkspaceTabNavigationRef.current = null
    }
    const closeIndex = workspaceTabs.findIndex(t => t.id === tabId)
    if (closeIndex === -1) return
    const nextTabs = workspaceTabs.filter(t => t.id !== tabId)
    const nextActive = tabId === activeWorkspaceTabId
      ? (nextTabs[Math.max(0, closeIndex - 1)] ?? nextTabs[0])
      : null
    dispatch({ type: 'removeTab', tabId })
    if (!nextActive) return
    if (nextActive.route !== currentRoute) {
      pendingWorkspaceTabNavigationRef.current = {
        tabId: nextActive.id,
        route: normalizeTabRoute(nextActive.route),
      }
      navigate(nextActive.route)
    }
  }, [activeWorkspaceTabId, currentRoute, navigate, workspaceTabs])

  const getWebSiteSelectCallback = useCallback((tabId: string) => {
    let callback = webSiteSelectCallbackByTabIdRef.current.get(tabId)
    if (!callback) {
      callback = (siteId: string) => handlePersistentWebSiteSelectRef.current(tabId, siteId)
      webSiteSelectCallbackByTabIdRef.current.set(tabId, callback)
    }
    return callback
  }, [])

  const handlePersistentWebSiteSelect = useCallback((tabId: string, siteId: string) => {
    const nextSearch = new URLSearchParams()
    nextSearch.set('site', siteId)
    dispatch({
      type: 'selectWebSite',
      tabId,
      siteId,
      activeWebTabId: isWebRoute ? activeWorkspaceTabId : null,
    })
    if (tabId !== activeWorkspaceTabId) return
    navigate(`/web?${nextSearch.toString()}`, { replace: true })
  }, [activeWorkspaceTabId, isWebRoute, navigate])
  handlePersistentWebSiteSelectRef.current = handlePersistentWebSiteSelect

  const syncActiveWorkspaceTabLabel = useCallback((labelPathname: string, nextLabel: string) => {
    if (parseTabRoute(currentRouteRef.current).pathname !== labelPathname) return
    const tabId = activeWorkspaceTabIdRef.current
    if (!tabId) return
    dispatch({ type: 'setTabLabel', tabId, label: nextLabel })
  }, [])

  return {
    workspaceTabs,
    activeWorkspaceTabId,
    activeWorkspaceTab,
    persistentChatTabIds,
    persistentWebTabIds,
    persistentWebSiteIdByTabId,
    persistentThinkingSpaceTabIds,
    persistentOrganizerRouteByTabId,
    persistentRouteMounts,
    mountedTabIdSet,

    isChatRoute,
    isWebRoute,
    isOrganizerRoute,
    isNewThoughtRoute,
    isThinkingSpaceRoute,
    isWebullRoute,
    usesPersistentRouteSurface,

    activeChatTabIds,
    activeWebTabIds,
    activeThinkingSpaceTabIds,
    activeOrganizerRoute,

    activeWorkspaceTabDisplayRoute,
    derivedActiveWorkspaceTabLabel,
    activeWorkspaceTabLabel,

    pendingWorkspaceTabNavigationRef,
    activeWorkspaceTabIdRef,
    tabSwitchPerfRef,

    handleCreateWorkspaceTab,
    handleSelectWorkspaceTab,
    handleCloseWorkspaceTab,
    handlePersistentWebSiteSelect,
    getWebSiteSelectCallback,
    syncActiveWorkspaceTabLabel,
  }
}
