import ThinkingSpaceOrch from '@/components/orchestrators/ThinkingSpaceOrch'
import RouteActivityProviderBlock from '@/components/lego_blocks/units/RouteActivityProviderBlock'

interface ThinkingSpaceProps {
  active?: boolean
  routeOverride?: string
}

export default function ThinkingSpace({ active = true, routeOverride }: ThinkingSpaceProps) {
  return (
    <RouteActivityProviderBlock active={active}>
      <div className="h-full min-h-0">
        <ThinkingSpaceOrch routeOverride={routeOverride} />
      </div>
    </RouteActivityProviderBlock>
  )
}
