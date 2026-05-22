import SubNavTabsBlock from '@/components/lego_blocks/units/ui/SubNavTabsBlock'
import ScheduleListBlock from '@/components/lego_blocks/integrations/ScheduleListBlock'

interface SchedulesOrchProps {
  active?: boolean
}

export default function SchedulesOrch(_props: SchedulesOrchProps) {
  return (
    <div className="flex h-full min-h-0">
      {/* ── Left sidebar (mirrors ChatOrch's sidebar pattern) ── */}
      <aside className="flex w-48 shrink-0 flex-col overflow-hidden border-r border-border/50">
        <div className="ltm-shell-segment-header flex h-11 shrink-0 items-center justify-between gap-1 px-2">
          <SubNavTabsBlock
            ariaLabel="AI section"
            className="text-xs"
            tabs={[
              { to: '/ai/chat', label: 'Chat' },
              { to: '/ai/schedules', label: 'Schedules' },
            ]}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 text-xs text-muted-foreground">
          {/* Future: schedule filter / category nav */}
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Schedules</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Background tasks that run on a schedule — anchor pings, auto-commits, scheduled agent runs.
            </p>
          </header>

          <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <strong className="font-semibold">Heads up:</strong> Scheduled jobs run through Thinking Space itself,
            so the app needs to be running at the scheduled time for jobs to fire. Quitting the app pauses your schedules.
          </div>

          <ScheduleListBlock />
        </div>
      </div>
    </div>
  )
}
