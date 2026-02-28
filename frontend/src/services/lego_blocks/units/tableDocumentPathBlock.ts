export function isTableDocumentPathBlock(path: string): boolean {
  return /\.(csv|tsv|xlsx|gsheet|gsheet\.json)$/i.test(path)
}

export function tableDocumentKindFromPathBlock(path: string): 'csv' | 'tsv' | 'xlsx' | 'gsheet' {
  if (/\.tsv$/i.test(path)) return 'tsv'
  if (/\.xlsx$/i.test(path)) return 'xlsx'
  if (/\.gsheet(\.json)?$/i.test(path)) return 'gsheet'
  return 'csv'
}

