import ChatOrch from '@/components/orchestrators/ChatOrch'
import RouteActivityProviderBlock from '@/components/lego_blocks/units/RouteActivityProviderBlock'

interface ChatPageProps {
  active?: boolean
}

export default function Chat({ active = true }: ChatPageProps) {
  return (
    <RouteActivityProviderBlock active={active}>
      <div className="h-full min-h-0 overflow-hidden">
        <ChatOrch active={active} />
      </div>
    </RouteActivityProviderBlock>
  )
}
