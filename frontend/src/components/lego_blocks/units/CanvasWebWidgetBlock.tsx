import { useEffect, useState } from 'react'
import UrlDocumentBlock from '@/components/lego_blocks/integrations/UrlDocumentBlock'
import type { CanvasWebWidgetTile } from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'
import type { WebSiteBlock } from '@/services/lego_blocks/units/webSiteBlock'
import { readWebSitePreferencesOrch } from '@/services/orchestrators/webSiteOrch'

interface Props {
  tile: CanvasWebWidgetTile
  /** Externally provided suspend flag — true when the tile is off-canvas. */
  suspended: boolean
  /** Bumping this remounts the underlying webview to force a fresh load. */
  reloadKey: number
}

// Tall buffer below the region so the webview has somewhere to render content
// that may overflow the capture box (e.g. dynamic widgets that grow vertically).
const HEIGHT_BUFFER_PX = 200

export default function CanvasWebWidgetBlock({ tile, suspended, reloadKey }: Props) {
  const theme = useCanvasThemeBlock()
  const [site, setSite] = useState<WebSiteBlock | null>(null)
  const [siteLookupFailed, setSiteLookupFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void readWebSitePreferencesOrch()
      .then(prefs => {
        if (cancelled) return
        const match = prefs.bookmarks.find(b => b.id === tile.siteId) ?? null
        setSite(match)
        setSiteLookupFailed(match === null)
      })
      .catch(() => {
        if (cancelled) return
        setSiteLookupFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [tile.siteId])

  if (siteLookupFailed || !site) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.tileTextMuted,
          fontSize: 12,
          padding: 12,
          textAlign: 'center',
        }}
      >
        {siteLookupFailed
          ? 'This widget points at a Web tab site that no longer exists.'
          : 'Loading widget…'}
      </div>
    )
  }

  // Page render box: matches the width used during capture; height generous
  // enough to contain region + buffer so the clipped area is always populated.
  const pageHeight = tile.region.y + tile.region.h + HEIGHT_BUFFER_PX

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: theme.tileBg,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -tile.region.x,
          top: -tile.region.y,
          width: tile.pageWidth,
          height: pageHeight,
        }}
      >
        <UrlDocumentBlock
          key={reloadKey}
          url={site.url}
          partition={site.partition}
          hideHeader
          suspended={suspended}
          className="absolute inset-0"
        />
      </div>
    </div>
  )
}
