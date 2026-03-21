import ChatOrch from '@/components/orchestrators/ChatOrch'

interface ChatPageProps {
  active?: boolean
}

export default function Chat({ active = true }: ChatPageProps) {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ChatOrch active={active} />
    </div>
  )
}
