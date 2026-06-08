import { Link } from 'react-router-dom'
import Starfield from '@/components/lego_blocks/units/StarfieldBlock'
import TodayFileActivityOrch from '@/components/orchestrators/TodayFileActivityOrch'
import HomeDashboardOrch from '@/components/orchestrators/HomeDashboardOrch'
import AiActivityPanelBlock from '@/components/lego_blocks/integrations/AiActivityPanelBlock'
import { useUserProfileBlock } from '@/components/lego_blocks/hooks/shared/useUserProfileBlock'
import { useDashboardActivityBlock } from '@/components/lego_blocks/hooks/shared/useDashboardActivityBlock'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'

export default function Home() {
  const { profile } = useUserProfileBlock()
  const activity = useDashboardActivityBlock('30d')
  const theme = useCanvasThemeBlock()

  return (
    <div className="relative isolate ltm-page">
      <div className="ltm-page-fixed-bg-anchor">
        <div className="ltm-page-fixed-bg-canvas" style={{ background: theme.outerBg }}>
          {theme.showNebula && (
            <div className="absolute inset-0" style={{ backgroundImage: theme.nebulaGradient }} />
          )}
          {theme.showStars && <Starfield />}
          {theme.vignetteGradient && (
            <div className="absolute inset-0" style={{ background: theme.vignetteGradient }} />
          )}
        </div>
      </div>

      <div className="relative z-10 ltm-page-shell ltm-shell-medium pt-10 pb-6 sm:pt-16 sm:pb-10 md:pt-24 md:pb-16">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">
            Thinking Space
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Welcome, {profile.name}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
            A calm focused thinking space. Open the side drawer to pick a tool and get started.
          </p>
        </header>

        <div className="mt-10 h-32 sm:mt-12 sm:h-36 md:mt-14 md:h-40" aria-hidden="true" />

        <section>
          <HomeDashboardOrch activity={activity} />
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <h2 className="text-base font-semibold">AI activity</h2>
          </div>
          <div className="mt-4">
            <AiActivityPanelBlock />
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <h2 className="text-base font-semibold">What you did today</h2>
            <Link to="/git-insights" className="text-sm text-muted-foreground hover:text-foreground">
              Open insights
            </Link>
          </div>
          <div className="mt-4">
            <TodayFileActivityOrch
              highlights={activity.series?.highlights ?? null}
              highlightsLoading={activity.loading}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
