export interface ExcalidrawPlusToolRouteBlock {
  route: string
  label: string
  description: string
  legacyRoute: string
}

export const EXCALIDRAW_PLUS_ROOT_ROUTE = '/excalidraw-plus'
export const EXCALIDRAW_PLUS_DEFAULT_SUBPAGE_ROUTE = '/excalidraw-plus/plugin'

export const EXCALIDRAW_PLUS_TOOL_ROUTES: readonly ExcalidrawPlusToolRouteBlock[] = [
  {
    route: '/excalidraw-plus/plugin',
    label: 'Excalidraw Plugin',
    description: 'Install and update the Obsidian Excalidraw community plugin.',
    legacyRoute: '/excalidraw-plugin',
  },
  {
    route: '/excalidraw-plus/format',
    label: 'Format for Excalidraw',
    description: 'Convert notes into Excalidraw-friendly markdown.',
    legacyRoute: '/format-excalidraw',
  },
  {
    route: '/excalidraw-plus/mindmap',
    label: 'Mindmap Builder',
    description: 'Generate and preview mindmaps from markdown.',
    legacyRoute: '/mindmap-builder',
  },
  {
    route: '/excalidraw-plus/pdf',
    label: 'PDF to Markdown',
    description: 'Extract markdown-ready content from PDFs.',
    legacyRoute: '/pdf-to-markdown',
  },
  {
    route: '/excalidraw-plus/transcript',
    label: 'Transcript Cleaner',
    description: 'Clean and normalize transcript text for notes.',
    legacyRoute: '/transcript-cleaner',
  },
]

export function isExcalidrawPlusRoute(pathname: string): boolean {
  if (pathname === EXCALIDRAW_PLUS_ROOT_ROUTE) return true
  return EXCALIDRAW_PLUS_TOOL_ROUTES.some(
    ({ route, legacyRoute }) => pathname === route || pathname === legacyRoute,
  )
}
