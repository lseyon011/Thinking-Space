export type GoogleDocFileKindBlock = 'gdoc' | 'docx'

export function isGoogleDocDocumentPathBlock(path: string): boolean {
  return /\.(gdoc|gdoc\.json|docx)$/i.test(path)
}

export function googleDocFileKindFromPathBlock(path: string): GoogleDocFileKindBlock {
  if (/\.docx$/i.test(path)) return 'docx'
  return 'gdoc'
}
