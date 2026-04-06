import PersonalToolsOrch from '../components/orchestrators/PersonalToolsOrch'

interface PersonalToolsPageProps {
  pageLabel?: string
}

export default function PersonalToolsPage({ pageLabel: _pageLabel }: PersonalToolsPageProps) {
  return (
    <div className="ltm-page">
      <PersonalToolsOrch />
    </div>
  )
}
