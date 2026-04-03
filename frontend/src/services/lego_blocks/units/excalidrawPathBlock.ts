export function isExcalidrawPathBlock(path: string): boolean {
  const lower = path.toLowerCase()
  return lower.endsWith('.excalidraw') || lower.endsWith('.excalidraw.md')
}
