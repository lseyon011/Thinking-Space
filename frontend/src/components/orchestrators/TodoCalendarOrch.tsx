import SectionChecklistBlock from '@/components/lego_blocks/SectionChecklistBlock'
import { getTodosMonth, getTodosSectionMonth, toggleTodo } from '@/services/orchestrators/todosOrch'

interface TodoCalendarItem {
  checked: boolean
  file: string
  line: number
}

async function toggleTodoItem(item: TodoCalendarItem) {
  await toggleTodo(item.file, item.line)
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
