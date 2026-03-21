import WebOrch from '@/components/orchestrators/WebOrch'

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
    <div className="h-full min-h-0">
      <WebOrch active={active} selectedSiteId={selectedSiteId} onSelectSiteId={onSelectSiteId} />
    </div>
  )
}
