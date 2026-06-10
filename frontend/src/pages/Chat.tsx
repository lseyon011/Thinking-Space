import { memo } from 'react'
import ChatOrch from '@/components/orchestrators/ChatOrch'
import RouteActivityProviderBlock from '@/components/lego_blocks/units/RouteActivityProviderBlock'

interface ChatPageProps {
  active?: boolean
}

// memo: persistent surface — skip re-renders caused by unrelated App shell state.
export default memo(function Chat({ active = true }: ChatPageProps) {
  return (
    <RouteActivityProviderBlock active={active}>
      <div className="h-full min-h-0 overflow-hidden">
        <ChatOrch active={active} />
      </div>
    </RouteActivityProviderBlock>
  )
})
