import { Loader2, RefreshCw } from 'lucide-react'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'

interface ExecutionProgressBlockProps {
  currentOperation: string | null
  tasks: NodeRecord[]
  tasksLoading: boolean
  tasksError: string | null
  onRefresh?: () => void
  onSelectTask: (node: NodeRecord) => void
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleString()
}

function taskRowLabel(node: NodeRecord): string {
  const ticket = node.ticket?.trim() ?? ''
  const title = node.title?.trim() ?? ''
  if (!ticket) return title || node.key
  if (!title) return ticket
  if (title.startsWith(ticket)) return title
  return `${ticket} - ${title}`
}

export default function ExecutionProgressBlock({
  currentOperation,
  tasks,
  tasksLoading,
  tasksError,
  onRefresh,
  onSelectTask,
}: ExecutionProgressBlockProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Execution Progress</CardTitle>
          {onRefresh && (
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={tasksLoading}>
              {tasksLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentOperation && (
          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-foreground">
            {currentOperation}
          </div>
        )}

        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            In-Progress Tasks ({tasks.length})
          </div>
          {tasksError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {tasksError}
            </div>
          )}
          {tasks.length === 0 && !tasksLoading && !tasksError && (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
              No in-progress tasks for this project.
            </div>
          )}
          {tasks.map((task) => (
            <button
              key={task.uuid}
              type="button"
              className="w-full rounded-md border border-border/70 px-3 py-2 text-left transition-colors hover:bg-muted/30"
              onClick={() => onSelectTask(task)}
            >
              <div className="text-sm font-medium text-foreground">{taskRowLabel(task)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Owner: {task.owner || 'unassigned'} • Updated: {formatTimestamp(task.updatedAt)}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
