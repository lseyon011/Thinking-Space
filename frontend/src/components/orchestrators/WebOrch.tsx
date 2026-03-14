import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import UrlDocumentBlock from '@/components/lego_blocks/integrations/UrlDocumentBlock'
import WebSitePanelBlock from '@/components/lego_blocks/integrations/WebSitePanelBlock'
import { cn } from '@/lib/utils'
import { readWebSitePreferencesOrch } from '@/services/orchestrators/webSiteOrch'
import type { WebSiteBlock, WebSitePreferencesBlock } from '@/services/lego_blocks/units/webSiteBlock'
import {
  dispatchWebSidebarChromeStateBlock,
  WEB_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK,
  WEB_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK,
} from '@/services/lego_blocks/units/webSidebarChromeBlock'

export default function WebOrch() {
  const [prefs, setPrefs] = useState<WebSitePreferencesBlock>({ bookmarks: [], groups: [] })
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [webviewHeaderVisible, setWebviewHeaderVisible] = useState(true)

  useEffect(() => { void readWebSitePreferencesOrch().then(setPrefs) }, [])

  const selectedSite = prefs.bookmarks.find(b => b.id === selectedSiteId) ?? null

  // Dispatch chrome state on changes
  useEffect(() => {
    const label = selectedSite ? `Web · ${selectedSite.name}` : 'Web'
    dispatchWebSidebarChromeStateBlock({
      enabled: true,
      collapsed: sidebarCollapsed,
      headerVisible: webviewHeaderVisible,
      showHeaderToggle: selectedSite !== null,
      label,
    })
  }, [selectedSiteId, sidebarCollapsed, webviewHeaderVisible, selectedSite])

  // Clean up chrome on unmount
  useEffect(() => {
    return () => {
      dispatchWebSidebarChromeStateBlock({
        enabled: false,
        collapsed: false,
        headerVisible: true,
        showHeaderToggle: false,
        label: 'Web',
      })
    }
  }, [])

  // Sidebar toggle
  useEffect(() => {
    const handler = () => setSidebarCollapsed(prev => !prev)
    window.addEventListener(WEB_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
    return () => window.removeEventListener(WEB_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
  }, [])

  // Header toggle
  useEffect(() => {
    const handler = () => setWebviewHeaderVisible(prev => !prev)
    window.addEventListener(WEB_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK, handler)
    return () => window.removeEventListener(WEB_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK, handler)
  }, [])

  const handleSelectSite = (site: WebSiteBlock) => {
    setSelectedSiteId(site.id)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border/50 overflow-hidden transition-[width,opacity] duration-200 ease-out',
          sidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-52 opacity-100',
        )}
        aria-hidden={sidebarCollapsed}
      >
        <WebSitePanelBlock
          bookmarks={prefs.bookmarks}
          groups={prefs.groups}
          selectedSiteId={selectedSiteId}
          onSelectSite={handleSelectSite}
          onClose={() => setSidebarCollapsed(true)}
        />
      </aside>

      {/* Content area */}
      <section className="relative min-h-0 flex-1">
        {selectedSite ? (
          <UrlDocumentBlock
            key={selectedSite.id}
            url={selectedSite.url}
            partition={selectedSite.partition}
            hideHeader={!webviewHeaderVisible}
            className="h-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Globe className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm">Select a site from the sidebar.</p>
            {prefs.bookmarks.length === 0 && (
              <p className="text-xs text-muted-foreground/60">Add sites in Settings → Web.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
