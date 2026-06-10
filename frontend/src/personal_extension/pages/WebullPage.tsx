import { memo } from 'react'
import WebullOrch from '../components/orchestrators/WebullOrch'

interface WebullPageProps {
  pageLabel?: string
}

// memo: persistent surface — skip re-renders caused by unrelated App shell state.
export default memo(function WebullPage({ pageLabel }: WebullPageProps) {
  const title = pageLabel?.trim() || 'Webull'
  return (
    <div className="ltm-page h-full">
      <WebullOrch pageTitle={title} />
    </div>
  )
})
