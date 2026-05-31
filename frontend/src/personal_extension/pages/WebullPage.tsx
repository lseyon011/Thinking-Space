import WebullOrch from '../components/orchestrators/WebullOrch'

interface WebullPageProps {
  pageLabel?: string
}

export default function WebullPage({ pageLabel }: WebullPageProps) {
  const title = pageLabel?.trim() || 'Webull'
  return (
    <div className="ltm-page h-full">
      <WebullOrch pageTitle={title} />
    </div>
  )
}
