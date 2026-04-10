import WebOrch from '@/components/orchestrators/WebOrch'
import RouteActivityProviderBlock from '@/components/lego_blocks/units/RouteActivityProviderBlock'

interface WebPageProps {
  active?: boolean
  selectedSiteId?: string | null
  onSelectSiteId?: (siteId: string) => void
}

export default function Web({
  active = true,
  selectedSiteId,
  onSelectSiteId,
}: WebPageProps) {
  return (
    <RouteActivityProviderBlock active={active}>
      <div className="h-full min-h-0">
        <WebOrch active={active} selectedSiteId={selectedSiteId} onSelectSiteId={onSelectSiteId} />
      </div>
    </RouteActivityProviderBlock>
  )
}
