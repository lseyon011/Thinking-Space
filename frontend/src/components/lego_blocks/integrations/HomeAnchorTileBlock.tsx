import { memo } from 'react'
import DashboardChartsBlock from '@/components/lego_blocks/integrations/DashboardChartsBlock'
import ActivityHotspotBlock from '@/components/lego_blocks/integrations/ActivityHotspotBlock'
import AiActivityPanelBlock from '@/components/lego_blocks/integrations/AiActivityPanelBlock'
import TodayFileActivityOrch from '@/components/orchestrators/TodayFileActivityOrch'
import { useUserProfileBlock } from '@/components/lego_blocks/hooks/shared/useUserProfileBlock'
import { useDashboardActivityBlock } from '@/components/lego_blocks/hooks/shared/useDashboardActivityBlock'
import {
  useCanvasThemeBlock,
  type CanvasThemeTokens,
} from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'

interface AnchorElementProps {
  centerX: number
  centerY: number
}

const ANCHOR_ELEMENTS = {
  welcome: { w: 640, h: 120, offsetY: -520 },
  charts: { w: 880, h: 360, offsetY: -380 },
  hotspot: { w: 880, h: 280, offsetY: 20 },
  today: { w: 880, h: 440, offsetY: 340 },
  // Tall enough to hold the chart + drill-down table without scrolling.
  aiActivity: { w: 880, h: 760, offsetY: 820 },
} as const

function FloatingPanel({
  x,
  y,
  w,
  h,
  variant = 'panel',
  theme,
  children,
}: {
  x: number
  y: number
  w: number
  h: number
  variant?: 'panel' | 'text'
  theme: CanvasThemeTokens
  children: React.ReactNode
}) {
  const isPanel = variant === 'panel'
  return (
    <div
      data-canvas-anchor-element="true"
      onMouseDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        padding: isPanel ? 20 : 0,
        borderRadius: isPanel ? 14 : 0,
        background: isPanel ? theme.anchorPanelBg : 'transparent',
        border: isPanel ? `1px solid ${theme.anchorPanelBorder}` : 'none',
        boxShadow: isPanel ? theme.anchorPanelShadow : 'none',
        overflow: 'hidden',
        cursor: 'default',
        zIndex: 2,
      }}
    >
      {children}
    </div>
  )
}

function HomeAnchorTileBlockImpl({ centerX, centerY }: AnchorElementProps) {
  const theme = useCanvasThemeBlock()
  const { profile } = useUserProfileBlock()
  const activity = useDashboardActivityBlock('30d')

  const place = (key: keyof typeof ANCHOR_ELEMENTS) => {
    const { w, h, offsetY } = ANCHOR_ELEMENTS[key]
    return { x: centerX - w / 2, y: centerY + offsetY, w, h }
  }

  const welcome = place('welcome')
  const charts = place('charts')
  const hotspot = place('hotspot')
  const today = place('today')
  const aiActivity = place('aiActivity')

  return (
    <div className={theme.isDark ? 'dark' : ''}>
      <FloatingPanel {...welcome} variant="text" theme={theme}>
        <div style={{ textAlign: 'center', userSelect: 'none' }}>
          <p
            style={{
              fontSize: 12,
              color: theme.anchorEyebrow,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Thinking Space
          </p>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: theme.anchorHeading,
              margin: '10px 0 0',
              letterSpacing: '-0.02em',
            }}
          >
            Welcome, {profile.name}
          </h1>
        </div>
      </FloatingPanel>

      <FloatingPanel {...charts} theme={theme}>
        <DashboardChartsBlock
          series={activity.series}
          loading={activity.loading}
          error={activity.error}
          preset={activity.preset}
          onPresetChange={activity.setPreset}
        />
      </FloatingPanel>

      <FloatingPanel {...hotspot} theme={theme}>
        <ActivityHotspotBlock
          days={activity.series?.days ?? []}
          loading={activity.loading}
          startIso={activity.startIso}
          endIso={activity.endIso}
        />
      </FloatingPanel>

      <FloatingPanel {...today} theme={theme}>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.anchorHeading,
            margin: '0 0 12px',
          }}
        >
          What you did today
        </h2>
        <TodayFileActivityOrch
          highlights={activity.series?.highlights ?? null}
          highlightsLoading={activity.loading}
        />
      </FloatingPanel>

      <FloatingPanel {...aiActivity} theme={theme}>
        <AiActivityPanelBlock />
      </FloatingPanel>
    </div>
  )
}

// Memo prevents this whole subtree (charts, hotspot, today activity) from
// re-rendering on every wheel pan/zoom in HomeCanvasOrch — its props are
// constants for the lifetime of the page.
const HomeAnchorTileBlock = memo(HomeAnchorTileBlockImpl)
export default HomeAnchorTileBlock
