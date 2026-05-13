export function isHtmlDocumentPathBlock(path: string): boolean {
  return /\.(html|htm)$/i.test(path)
}
