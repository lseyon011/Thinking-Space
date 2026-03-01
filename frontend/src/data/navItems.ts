import type { ComponentType } from 'react'
import {
  Bot,
  Compass,
  FolderKanban,
  GitBranch,
  MessageSquare,
  PlusSquare,
  Sparkles,
  Wrench,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  activePaths?: string[]
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { to: '/thinking-space', label: 'Thinking Space', icon: Compass },
  { to: '/new-thought', label: 'New Note', icon: PlusSquare },
  { to: '/git-insights', label: 'Insights', icon: GitBranch },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/thinking-organizer', label: 'Thinking Organizer', icon: FolderKanban, activePaths: ['/file-organizer'] },
]

export const TOOL_NAV_ITEMS: NavItem[] = [
  { to: '/excalidraw-plugin', label: 'Excalidraw Plugin', icon: Sparkles },
  { to: '/format-excalidraw', label: 'Format for Excalidraw', icon: Sparkles },
  { to: '/mindmap-builder', label: 'Mindmap Builder', icon: Sparkles },
  { to: '/pdf-to-markdown', label: 'PDF to Markdown', icon: Sparkles },
  { to: '/transcript-cleaner', label: 'Transcript Cleaner', icon: Sparkles },
]

export function createUtilityNavItems(extensionBuilderEnabled: boolean): NavItem[] {
  const items: NavItem[] = [
    { to: '/ai-settings', label: 'AI Settings', icon: Bot },
    { to: '/capabilities', label: 'Capabilities', icon: Wrench },
  ]
  if (extensionBuilderEnabled) {
    items.splice(1, 0, { to: '/extension-builder', label: 'Extension Builder', icon: Sparkles })
  }
  return items
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.to) return true
  return (item.activePaths ?? []).includes(pathname)
}
