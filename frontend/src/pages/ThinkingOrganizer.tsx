import ThinkingOrganizerOrch from '@/components/orchestrators/ThinkingOrganizerOrch'

interface ThinkingOrganizerPageProps {
  active?: boolean
}

export default function ThinkingOrganizer({ active = true }: ThinkingOrganizerPageProps) {
  return (
    <div className="ltm-page">
      <ThinkingOrganizerOrch active={active} />
    </div>
  )
}
