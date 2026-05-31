export interface SidebarChromeStateBlock {
  enabled: boolean
  collapsed?: boolean
  label?: string
  headerVisible?: boolean
  showHeaderToggle?: boolean
  siteLabels?: Record<string, string>
}

export interface SidebarChromeBlock<S extends SidebarChromeStateBlock = SidebarChromeStateBlock> {
  id: string
  stateEvent: string
  toggleEvent: string
  toggleHeaderEvent: string
  dispatchState: (state: S) => void
  dispatchToggle: () => void
  dispatchToggleHeader: () => void
}

export function createSidebarChromeBlock<S extends SidebarChromeStateBlock = SidebarChromeStateBlock>(
  id: string,
): SidebarChromeBlock<S> {
  const stateEvent = `ltm:${id}:sidebar-chrome-state`
  const toggleEvent = `ltm:${id}:sidebar-chrome-toggle`
  const toggleHeaderEvent = `ltm:${id}:sidebar-chrome-toggle-header`
  return {
    id,
    stateEvent,
    toggleEvent,
    toggleHeaderEvent,
    dispatchState: (state) =>
      window.dispatchEvent(new CustomEvent<S>(stateEvent, { detail: state })),
    dispatchToggle: () =>
      window.dispatchEvent(new CustomEvent<void>(toggleEvent)),
    dispatchToggleHeader: () =>
      window.dispatchEvent(new CustomEvent<void>(toggleHeaderEvent)),
  }
}
