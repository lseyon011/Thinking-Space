import { memo } from 'react'
import WebOrch from '@/components/orchestrators/WebOrch'
import RouteActivityProviderBlock from '@/components/lego_blocks/units/RouteActivityProviderBlock'

interface WebPageProps {
  active?: boolean
  selectedSiteId?: string | null
  onSelectSiteId?: (siteId: string) => void
}

// memo: persistent surface — skip re-renders caused by unrelated App shell state.
// Callers must pass a stable onSelectSiteId for the memo to hold.
export default memo(function Web({
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
})
