import { UserSquare2 } from 'lucide-react'
import PersonalExtensionOrch from '../components/orchestrators/PersonalExtensionOrch'

export default function PersonalExtensionPage() {
  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide flex flex-col gap-4">
        <header className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <UserSquare2 className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Personal Extension</h1>
            <p className="text-sm text-muted-foreground">
              Private tab and service workspace backed by local app storage.
            </p>
          </div>
        </header>
        <PersonalExtensionOrch />
      </div>
    </div>
  )
}
