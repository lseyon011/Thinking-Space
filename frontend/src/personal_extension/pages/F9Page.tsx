import { UserSquare2 } from 'lucide-react'
import F9Orch from '../components/orchestrators/F9Orch'

export default function F9Page() {
  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide flex flex-col gap-4">
        <header className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <UserSquare2 className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">F9</h1>
            <p className="text-sm text-muted-foreground">
              Personal market workspace with Webull-backed views.
            </p>
          </div>
        </header>
        <F9Orch />
      </div>
    </div>
  )
}
