export function isPdfDocumentPathBlock(path: string): boolean {
  return /\.pdf$/i.test(path)
}
