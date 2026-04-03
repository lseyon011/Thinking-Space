import ThinkingSpaceOrch from '@/components/orchestrators/ThinkingSpaceOrch'

interface ThinkingSpaceProps {
  routeOverride?: string
}

export default function ThinkingSpace({ routeOverride }: ThinkingSpaceProps) {
  return (
    <div className="h-full min-h-0">
      <ThinkingSpaceOrch routeOverride={routeOverride} />
    </div>
  )
}
