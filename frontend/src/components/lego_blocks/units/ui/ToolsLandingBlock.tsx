import { LayoutGrid } from 'lucide-react'

// Neutral landing for the Tools section — shown when no specific tool is
// selected, prompting the user to pick one from the sidebar.
export default function ToolsLandingBlock() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 text-muted-foreground">
        <LayoutGrid className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Select a tool</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a tool from the sidebar to get started.
        </p>
      </div>
    </div>
  )
}
