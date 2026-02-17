import type { TodoMonthData, TodoSectionMonthData } from '../lego_blocks/typesBlock'
import { getVaultFS } from '../lego_blocks/fsBlock'
import {
  getTodosMonth as scanTodosMonth,
  getTodosSectionMonth as scanTodosSectionMonth,
  toggleTodo as scanToggleTodo,
  createTodo as scanCreateTodo,
} from '../lego_blocks/todoScannerBlock'
import { syncSingleFile } from './vaultSyncOrch'

export async function getTodosMonth(year: number, month: number): Promise<TodoMonthData> {
  const fs = getVaultFS()
  return scanTodosMonth(fs, year, month)
}

export async function getTodosSectionMonth(
  year: number,
  month: number,
  sections: string[],
): Promise<TodoSectionMonthData> {
  const fs = getVaultFS()
  return scanTodosSectionMonth(fs, year, month, sections)
}

export async function toggleTodo(filePath: string, lineNumber: number): Promise<void> {
  const fs = getVaultFS()
  await scanToggleTodo(fs, filePath, lineNumber)
  await syncSingleFile(filePath, fs)
}

export async function createTodos(
  folderPath: string,
  date: string,
  items: string[],
): Promise<{ output_path: string; items_added: number }> {
  const fs = getVaultFS()
  const result = await scanCreateTodo(fs, folderPath, date, items)
  await syncSingleFile(result.output_path, fs)
  return result
}
