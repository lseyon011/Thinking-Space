import SchedulesOrch from '@/components/orchestrators/SchedulesOrch'
import RouteActivityProviderBlock from '@/components/lego_blocks/units/RouteActivityProviderBlock'

interface SchedulesPageProps {
  active?: boolean
}

export default function Schedules({ active = true }: SchedulesPageProps) {
  return (
    <RouteActivityProviderBlock active={active}>
      <div className="h-full min-h-0 overflow-hidden">
        <SchedulesOrch active={active} />
      </div>
    </RouteActivityProviderBlock>
  )
}
