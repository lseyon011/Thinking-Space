import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import ExtensionBuilderOrch from '@/components/orchestrators/ExtensionBuilderOrch'

export default function ExtensionBuilder() {
  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide space-y-4">
        <header className="shrink-0">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Extension Builder</h1>
              <p className="text-sm text-muted-foreground">
                Generate, review, and activate declarative extension artifacts in your vault.
              </p>
            </div>
          </div>
        </header>
        <ExtensionBuilderOrch />
      </div>
    </div>
  )
}

