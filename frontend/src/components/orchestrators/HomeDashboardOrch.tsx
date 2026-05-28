import DashboardChartsBlock from '@/components/lego_blocks/integrations/DashboardChartsBlock'
import ActivityHotspotBlock from '@/components/lego_blocks/integrations/ActivityHotspotBlock'
import type { UseDashboardActivityResult } from '@/components/lego_blocks/hooks/shared/useDashboardActivityBlock'

interface HomeDashboardOrchProps {
  activity: UseDashboardActivityResult
}

export default function HomeDashboardOrch({ activity }: HomeDashboardOrchProps) {
  const { series, loading, error, preset, setPreset, startIso, endIso } = activity

  return (
    <div className="space-y-6">
      <DashboardChartsBlock
        series={series}
        loading={loading}
        error={error}
        preset={preset}
        onPresetChange={setPreset}
      />

      <ActivityHotspotBlock
        days={series?.days ?? []}
        loading={loading}
        startIso={startIso}
        endIso={endIso}
      />
    </div>
  )
}
