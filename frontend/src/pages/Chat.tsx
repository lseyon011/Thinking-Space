import { MessageSquare } from 'lucide-react'
import ChatOrch from '@/components/orchestrators/ChatOrch'

export default function Chat() {
  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide flex h-[calc(100dvh-3.5rem)] flex-col">
        <header className="mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Chat</h1>
              <p className="text-sm text-muted-foreground">Talk with your configured AI provider.</p>
            </div>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <ChatOrch />
        </div>
      </div>
    </div>
  )
}
