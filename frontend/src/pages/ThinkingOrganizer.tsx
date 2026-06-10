import { memo } from 'react'
import ThinkingOrganizerOrch from '@/components/orchestrators/ThinkingOrganizerOrch'

interface ThinkingOrganizerPageProps {
  active?: boolean
}

// memo: persistent surface — skip re-renders caused by unrelated App shell state.
export default memo(function ThinkingOrganizer({ active = true }: ThinkingOrganizerPageProps) {
  return (
    <div className="ltm-page">
      <ThinkingOrganizerOrch active={active} />
    </div>
  )
})
