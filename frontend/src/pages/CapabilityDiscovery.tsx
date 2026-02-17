import { Link } from 'react-router-dom'
import { ArrowLeft, Bot } from 'lucide-react'
import CapabilityDiscoveryOrch from '@/components/orchestrators/CapabilityDiscoveryOrch'

export default function CapabilityDiscovery() {
  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide">
        <header className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Capability Discovery</h1>
              <p className="text-muted-foreground">
                Inspect, invoke, and verify agent capabilities across local, Electron IPC, and FastAPI adapters.
              </p>
            </div>
          </div>
        </header>

        <CapabilityDiscoveryOrch />
      </div>
    </div>
  )
}
