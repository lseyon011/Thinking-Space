interface SchedulesOrchProps {
  active?: boolean
}

export default function SchedulesOrch(_props: SchedulesOrchProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
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

        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Schedule management UI coming soon. Layer 1 (Electron transport + launchd block) is next.
        </div>
      </div>
    </div>
  )
}
