import { GitBranch, Layers, Lightbulb, Loader2, Search } from 'lucide-react'
import type { ThoughtTraceResult } from '@/services/orchestrators/hierarchyTraceOrch'

interface ThoughtTraceBlockProps {
  selectedPath: string | null
  trace: ThoughtTraceResult | null
  loading: boolean
  error: string | null
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

export default function ThoughtTraceBlock({
  selectedPath,
  trace,
  loading,
  error,
}: ThoughtTraceBlockProps) {
  if (!selectedPath) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
        Select a thought from Thinking Space Explorer to trace where it is linked.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Tracing linked hierarchy...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!trace || trace.thought_id === null) {
    return (
      <div className="rounded-xl border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
        No hierarchy record yet for <span className="font-medium text-foreground">{selectedPath}</span>.
      </div>
    )
  }

  if (trace.routes.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
        Thought exists but is not linked to any hierarchy nodes yet.
      </div>
    )
  }

  const projectNames = unique(
    trace.routes.flatMap(route => route.chain.filter(node => node.type === 'project').map(node => node.title)),
  )
  const epicNames = unique(
    trace.routes.flatMap(route => route.chain.filter(node => node.type === 'epic').map(node => node.title)),
  )
  const ideaNames = unique(
    trace.routes.flatMap(route => route.chain.filter(node => node.type === 'idea').map(node => node.title)),
  )

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-card px-3 py-2.5">
        <div className="truncate text-sm font-medium">{trace.thought_title || trace.normalized_path}</div>
        <div className="truncate text-xs text-muted-foreground">{trace.normalized_path}</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Projects</div>
          <div className="mt-1 text-sm font-medium">{projectNames.length}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Epics</div>
          <div className="mt-1 text-sm font-medium">{epicNames.length}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ideas</div>
          <div className="mt-1 text-sm font-medium">{ideaNames.length}</div>
        </div>
      </div>

      <div className="space-y-2">
        {trace.routes.map(route => {
          const breadcrumb = route.chain.map(node => node.title).join(' / ')
          const projects = route.chain.filter(node => node.type === 'project').map(node => node.title)
          const epics = route.chain.filter(node => node.type === 'epic').map(node => node.title)
          const ideas = route.chain.filter(node => node.type === 'idea').map(node => node.title)

          return (
            <div key={route.link_id} className="rounded-xl border border-border/60 bg-card px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5" />
                <span>{new Date(route.linked_at).toLocaleString()}</span>
                <span>•</span>
                <span className="uppercase tracking-[0.12em]">{route.link_kind}</span>
              </div>
              <div className="mt-1 text-sm font-medium">{breadcrumb}</div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                <div className="inline-flex items-start gap-1.5">
                  <Search className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Projects: {projects.join(', ') || 'None'}</span>
                </div>
                <div className="inline-flex items-start gap-1.5">
                  <Layers className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Epics: {epics.join(', ') || 'None'}</span>
                </div>
                <div className="inline-flex items-start gap-1.5">
                  <Lightbulb className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Ideas: {ideas.join(', ') || 'None'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
