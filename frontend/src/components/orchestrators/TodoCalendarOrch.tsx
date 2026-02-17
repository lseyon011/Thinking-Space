import SectionChecklistBlock from '@/components/lego_blocks/SectionChecklistBlock'
import { getTodosMonth, getTodosSectionMonth } from '@/services/orchestrators/todosOrch'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import type { CapabilityActor } from '@/services/lego_blocks/capabilityRegistryBlock'

interface TodoCalendarItem {
  checked: boolean
  file: string
  line: number
}

const TODOS_CALENDAR_ACTOR: CapabilityActor = { kind: 'human', id: 'ui.todos-calendar' }

async function toggleTodoItem(item: TodoCalendarItem) {
  await invokeCapabilityOrThrow({
    capability: 'todos.toggle',
    input: {
      filePath: item.file,
      lineNumber: item.line,
    },
    actor: TODOS_CALENDAR_ACTOR,
  })
}

function renderTodoItemTextClassName(item: { checked: boolean }) {
  return `text-sm leading-snug transition-all ${
    item.checked
      ? 'line-through text-muted-foreground/50'
      : 'text-foreground/90 group-hover:text-foreground'
  }`
}

export default function TodoCalendarOrch() {
  return (
    <SectionChecklistBlock
      subjectTitle="Todos"
      subjectPluralLower="todos"
      fetchMonthData={getTodosMonth}
      fetchSectionMonthData={getTodosSectionMonth}
      onToggleItem={toggleTodoItem}
      renderItemTextClassName={renderTodoItemTextClassName}
    />
  )
}
