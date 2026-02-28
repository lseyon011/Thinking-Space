import pako from 'pako'
import {
  createEmptyCellBlock,
  createEmptySheetBlock,
  createEmptyTableDocumentBlock,
  type TableCellAlign,
  type TableCellBlock,
  type TableCellFormatBlock,
  type TableDocumentBlock,
  type TableSheetBlock,
} from '@/services/lego_blocks/units/tableDocumentSchemaBlock'
import { utf8ToBytesBlock, bytesToUtf8Block } from '@/services/lego_blocks/units/byteEncodingBlock'

interface ZipEntryBlock {
  name: string
  data: Uint8Array
}

interface ParsedStyleBlock {
  fontBold?: boolean
  fontItalic?: boolean
  fontUnderline?: boolean
  fontColor?: string
  fillColor?: string
  align?: TableCellAlign
  numberFormat?: TableCellFormatBlock['numberFormat']
}

export function decodeXlsxTableBlock(bytes: Uint8Array): TableDocumentBlock {
  const entries = unzipEntriesBlock(bytes)
  const workbookXml = getRequiredTextEntryBlock(entries, 'xl/workbook.xml')
  const workbookRelsXml = getRequiredTextEntryBlock(entries, 'xl/_rels/workbook.xml.rels')
  const sharedStrings = parseSharedStringsBlock(entries.get('xl/sharedStrings.xml'))
  const styleMap = parseStylesBlock(entries.get('xl/styles.xml'))
  const sheetTargets = parseWorkbookSheetTargetsBlock(workbookXml, workbookRelsXml)

  const sheets: TableSheetBlock[] = sheetTargets.map((target, idx) => {
    const worksheetPath = normalizeWorkbookTargetPathBlock(target.target)
    const sheetXmlBytes = entries.get(worksheetPath)
    if (!sheetXmlBytes) {
      return createEmptySheetBlock(target.name || `Sheet${idx + 1}`, `sheet-${idx + 1}`)
    }
    const rows = parseWorksheetRowsBlock(bytesToUtf8Block(sheetXmlBytes), sharedStrings, styleMap)
    return {
      id: `sheet-${idx + 1}`,
      name: target.name || `Sheet${idx + 1}`,
      rows: rows.length > 0 ? rows : [[createEmptyCellBlock('')]],
    }
  })

  const fallback = createEmptyTableDocumentBlock('xlsx')
  if (sheets.length === 0) return fallback
  return {
    kind: 'xlsx',
    sheets,
    activeSheetId: sheets[0].id,
  }
}

export function encodeXlsxTableBlock(document: TableDocumentBlock): Uint8Array {
  const sheets = document.sheets.length > 0 ? document.sheets : [createEmptySheetBlock()]
  const styleBuilder = createStylesBuilderBlock()
  const worksheetEntries: ZipEntryBlock[] = []
  const sheetRels: Array<{ id: string; name: string; target: string }> = []

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i]
    const sheetIndex = i + 1
    const relId = `rId${sheetIndex}`
    const worksheetPath = `xl/worksheets/sheet${sheetIndex}.xml`
    const xml = serializeWorksheetXmlBlock(sheet, styleBuilder)
    worksheetEntries.push({
      name: worksheetPath,
      data: utf8ToBytesBlock(xml),
    })
    sheetRels.push({
      id: relId,
      name: sheet.name || `Sheet${sheetIndex}`,
      target: `worksheets/sheet${sheetIndex}.xml`,
    })
  }

  const stylesXml = serializeStylesXmlBlock(styleBuilder)
  const workbookXml = serializeWorkbookXmlBlock(sheetRels)
  const workbookRelsXml = serializeWorkbookRelsXmlBlock(sheetRels)
  const contentTypesXml = serializeContentTypesXmlBlock(sheets.length)

  const entries: ZipEntryBlock[] = [
    { name: '[Content_Types].xml', data: utf8ToBytesBlock(contentTypesXml) },
    { name: '_rels/.rels', data: utf8ToBytesBlock(ROOT_RELS_XML_BLOCK) },
    { name: 'docProps/app.xml', data: utf8ToBytesBlock(APP_XML_BLOCK) },
    { name: 'docProps/core.xml', data: utf8ToBytesBlock(CORE_XML_BLOCK) },
    { name: 'xl/workbook.xml', data: utf8ToBytesBlock(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8ToBytesBlock(workbookRelsXml) },
    { name: 'xl/styles.xml', data: utf8ToBytesBlock(stylesXml) },
    ...worksheetEntries,
  ]

  return zipEntriesBlock(entries)
}

function parseWorksheetRowsBlock(
  worksheetXml: string,
  sharedStrings: string[],
  styleMap: Map<number, ParsedStyleBlock>,
): TableCellBlock[][] {
  const doc = parseXmlDocumentBlock(worksheetXml)
  const sheetData = findFirstDescendantByLocalNameBlock(doc, 'sheetData')
  if (!sheetData) return [[createEmptyCellBlock('')]]

  let maxRowIndex = 0
  let maxColIndex = 0
  const cells = new Map<string, TableCellBlock>()

  for (const rowNode of childElementsByLocalNameBlock(sheetData, 'row')) {
    const rowIndex = Math.max(1, parseInt(rowNode.getAttribute('r') || '1', 10))
    if (rowIndex > maxRowIndex) maxRowIndex = rowIndex
    for (const cellNode of childElementsByLocalNameBlock(rowNode, 'c')) {
      const ref = cellNode.getAttribute('r') || ''
      const cellPos = decodeCellReferenceBlock(ref)
      if (!cellPos) continue
      maxColIndex = Math.max(maxColIndex, cellPos.col + 1)
      const type = cellNode.getAttribute('t') || ''
      const styleIndex = parseInt(cellNode.getAttribute('s') || '0', 10)

      let value = ''
      if (type === 's') {
        const sharedIndex = parseInt(findFirstDescendantByLocalNameBlock(cellNode, 'v')?.textContent || '0', 10)
        value = sharedStrings[sharedIndex] ?? ''
      } else if (type === 'inlineStr') {
        value = findFirstDescendantByLocalNameBlock(cellNode, 'is')?.textContent ?? ''
      } else if (type === 'b') {
        value = (findFirstDescendantByLocalNameBlock(cellNode, 'v')?.textContent || '0') === '1' ? 'TRUE' : 'FALSE'
      } else {
        value = findFirstDescendantByLocalNameBlock(cellNode, 'v')?.textContent ?? ''
      }

      const style = styleMap.get(Number.isFinite(styleIndex) ? styleIndex : 0)
      const format = style ? styleToCellFormatBlock(style) : undefined

      cells.set(`${cellPos.row}:${cellPos.col}`, {
        value,
        format,
      })
    }
  }

  const rowCount = Math.max(1, maxRowIndex)
  const colCount = Math.max(1, maxColIndex)
  const rows: TableCellBlock[][] = []
  for (let r = 0; r < rowCount; r++) {
    const row: TableCellBlock[] = []
    for (let c = 0; c < colCount; c++) {
      row.push(cells.get(`${r}:${c}`) ?? createEmptyCellBlock(''))
    }
    rows.push(row)
  }
  return rows
}

function parseSharedStringsBlock(bytes: Uint8Array | undefined): string[] {
  if (!bytes) return []
  const doc = parseXmlDocumentBlock(bytesToUtf8Block(bytes))
  const items = findAllDescendantsByLocalNameBlock(doc, 'si')
  return items.map((item) => item.textContent || '')
}

function parseStylesBlock(bytes: Uint8Array | undefined): Map<number, ParsedStyleBlock> {
  const output = new Map<number, ParsedStyleBlock>()
  if (!bytes) return output
  const doc = parseXmlDocumentBlock(bytesToUtf8Block(bytes))
  const fontsNode = findFirstDescendantByLocalNameBlock(doc, 'fonts')
  const fillsNode = findFirstDescendantByLocalNameBlock(doc, 'fills')
  const cellXfsNode = findFirstDescendantByLocalNameBlock(doc, 'cellXfs')

  const fonts = fontsNode ? childElementsByLocalNameBlock(fontsNode, 'font') : []
  const fills = fillsNode ? childElementsByLocalNameBlock(fillsNode, 'fill') : []
  const xfs = cellXfsNode ? childElementsByLocalNameBlock(cellXfsNode, 'xf') : []

  for (let i = 0; i < xfs.length; i++) {
    const xf = xfs[i]
    const fontId = parseInt(xf.getAttribute('fontId') || '0', 10)
    const fillId = parseInt(xf.getAttribute('fillId') || '0', 10)
    const numFmtId = parseInt(xf.getAttribute('numFmtId') || '0', 10)
    const alignmentNode = findFirstDescendantByLocalNameBlock(xf, 'alignment')
    const horizontal = alignmentNode?.getAttribute('horizontal') || undefined

    const fontNode = fonts[Number.isFinite(fontId) ? fontId : 0]
    const fillNode = fills[Number.isFinite(fillId) ? fillId : 0]
    const style: ParsedStyleBlock = {}

    if (fontNode) {
      if (findFirstDescendantByLocalNameBlock(fontNode, 'b')) style.fontBold = true
      if (findFirstDescendantByLocalNameBlock(fontNode, 'i')) style.fontItalic = true
      if (findFirstDescendantByLocalNameBlock(fontNode, 'u')) style.fontUnderline = true
      const colorNode = findFirstDescendantByLocalNameBlock(fontNode, 'color')
      const rgb = colorNode?.getAttribute('rgb')
      if (rgb) style.fontColor = normalizeArgbHexBlock(rgb)
    }
    if (fillNode) {
      const patternFill = findFirstDescendantByLocalNameBlock(fillNode, 'patternFill')
      const fgColor = patternFill ? findFirstDescendantByLocalNameBlock(patternFill, 'fgColor') : null
      const rgb = fgColor?.getAttribute('rgb')
      if (rgb) style.fillColor = normalizeArgbHexBlock(rgb)
    }
    if (horizontal === 'left' || horizontal === 'center' || horizontal === 'right') {
      style.align = horizontal
    }
    const numberFormat = numFmtIdToFormatBlock(numFmtId)
    if (numberFormat) style.numberFormat = numberFormat

    output.set(i, style)
  }

  return output
}

function styleToCellFormatBlock(style: ParsedStyleBlock): TableCellFormatBlock | undefined {
  const format: TableCellFormatBlock = {}
  if (style.fontBold) format.bold = true
  if (style.fontItalic) format.italic = true
  if (style.fontUnderline) format.underline = true
  if (style.align) format.align = style.align
  if (style.fontColor) format.textColor = style.fontColor
  if (style.fillColor) format.backgroundColor = style.fillColor
  if (style.numberFormat) format.numberFormat = style.numberFormat
  return Object.keys(format).length > 0 ? format : undefined
}

function numFmtIdToFormatBlock(numFmtId: number): TableCellFormatBlock['numberFormat'] | undefined {
  if (numFmtId === 2 || numFmtId === 3 || numFmtId === 4) return 'number'
  if (numFmtId === 9 || numFmtId === 10) return 'percent'
  if (numFmtId === 14 || numFmtId === 15 || numFmtId === 16 || numFmtId === 17) return 'date'
  if (numFmtId === 49) return 'text'
  if (numFmtId === 44 || numFmtId === 164) return 'currency'
  return undefined
}

function parseWorkbookSheetTargetsBlock(
  workbookXml: string,
  workbookRelsXml: string,
): Array<{ name: string; target: string }> {
  const workbook = parseXmlDocumentBlock(workbookXml)
  const rels = parseXmlDocumentBlock(workbookRelsXml)
  const relById = new Map<string, string>()

  for (const rel of findAllDescendantsByLocalNameBlock(rels, 'Relationship')) {
    const id = rel.getAttribute('Id') || ''
    const target = rel.getAttribute('Target') || ''
    if (id && target) relById.set(id, target)
  }

  const sheetsNode = findFirstDescendantByLocalNameBlock(workbook, 'sheets')
  if (!sheetsNode) return []
  return childElementsByLocalNameBlock(sheetsNode, 'sheet').map((sheet) => {
    const name = sheet.getAttribute('name') || 'Sheet'
    const relId = sheet.getAttribute('r:id') || sheet.getAttribute('id') || ''
    return {
      name,
      target: relById.get(relId) || '',
    }
  }).filter(item => item.target)
}

function normalizeWorkbookTargetPathBlock(target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  if (target.startsWith('xl/')) return target
  return `xl/${target.replace(/^\.?\//, '')}`
}

function serializeWorksheetXmlBlock(sheet: TableSheetBlock, stylesBuilder: ReturnType<typeof createStylesBuilderBlock>): string {
  const rows: string[] = []
  const normalizedRows = sheet.rows.length > 0 ? sheet.rows : [[createEmptyCellBlock('')]]

  for (let rowIndex = 0; rowIndex < normalizedRows.length; rowIndex++) {
    const row = normalizedRows[rowIndex]
    let lastUsedCol = -1
    for (let col = row.length - 1; col >= 0; col--) {
      const cell = row[col]
      if (cell.value !== '' || hasFormatBlock(cell.format)) {
        lastUsedCol = col
        break
      }
    }
    if (lastUsedCol < 0) continue

    const cells: string[] = []
    for (let colIndex = 0; colIndex <= lastUsedCol; colIndex++) {
      const cell = row[colIndex] ?? createEmptyCellBlock('')
      const ref = `${columnIndexToNameBlock(colIndex)}${rowIndex + 1}`
      const styleIndex = stylesBuilder.styleIndexForFormat(cell.format)
      const styleAttr = styleIndex > 0 ? ` s="${styleIndex}"` : ''
      const escaped = escapeXmlBlock(cell.value)
      const needsPreserve = /^\s|\s$|\n|\r|\t| {2,}/.test(cell.value)
      const preserveAttr = needsPreserve ? ' xml:space="preserve"' : ''
      cells.push(`<c r="${ref}"${styleAttr} t="inlineStr"><is><t${preserveAttr}>${escaped}</t></is></c>`)
    }
    rows.push(`<row r="${rowIndex + 1}">${cells.join('')}</row>`)
  }

  const sheetData = rows.length > 0 ? rows.join('') : '<row r="1"><c r="A1" t="inlineStr"><is><t></t></is></c></row>'
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>${sheetData}</sheetData>
</worksheet>`
}

function serializeWorkbookXmlBlock(sheetRels: Array<{ id: string; name: string }>): string {
  const sheetsXml = sheetRels
    .map((sheet, idx) => `<sheet name="${escapeXmlAttrBlock(sheet.name)}" sheetId="${idx + 1}" r:id="${sheet.id}"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetsXml}</sheets>
</workbook>`
}

function serializeWorkbookRelsXmlBlock(sheetRels: Array<{ id: string; target: string }>): string {
  const rels = sheetRels
    .map((sheet) => `<Relationship Id="${sheet.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${sheet.target}"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
  <Relationship Id="rId${sheetRels.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function serializeContentTypesXmlBlock(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, idx) => {
    const num = idx + 1
    return `<Override PartName="/xl/worksheets/sheet${num}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${overrides}
</Types>`
}

function createStylesBuilderBlock() {
  const fonts = new Map<string, { xml: string; index: number }>()
  const fills = new Map<string, { xml: string; index: number }>()
  const xfs = new Map<string, { xml: string; index: number }>()
  const customNumFmt = new Map<string, number>()

  fonts.set('default', { index: 0, xml: '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' })
  fills.set('none', { index: 0, xml: '<fill><patternFill patternType="none"/></fill>' })
  fills.set('gray125', { index: 1, xml: '<fill><patternFill patternType="gray125"/></fill>' })
  xfs.set('default', { index: 0, xml: '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' })

  const styleIndexForFormat = (format: TableCellFormatBlock | undefined): number => {
    if (!hasFormatBlock(format)) return 0
    const fontKey = JSON.stringify({
      bold: !!format?.bold,
      italic: !!format?.italic,
      underline: !!format?.underline,
      textColor: format?.textColor || '',
    })
    const fillKey = JSON.stringify({
      backgroundColor: format?.backgroundColor || '',
    })
    const numFmtId = resolveNumFmtIdBlock(format?.numberFormat, customNumFmt)
    const align = format?.align || ''
    const xfKey = JSON.stringify({ fontKey, fillKey, numFmtId, align })

    if (!fonts.has(fontKey)) {
      const parts: string[] = []
      if (format?.bold) parts.push('<b/>')
      if (format?.italic) parts.push('<i/>')
      if (format?.underline) parts.push('<u/>')
      if (format?.textColor) parts.push(`<color rgb="${toArgbBlock(format.textColor)}"/>`)
      parts.push('<sz val="11"/>')
      parts.push('<name val="Calibri"/>')
      parts.push('<family val="2"/>')
      const index = fonts.size
      fonts.set(fontKey, { index, xml: `<font>${parts.join('')}</font>` })
    }

    if (!fills.has(fillKey)) {
      const index = fills.size
      if (format?.backgroundColor) {
        fills.set(fillKey, {
          index,
          xml: `<fill><patternFill patternType="solid"><fgColor rgb="${toArgbBlock(format.backgroundColor)}"/><bgColor indexed="64"/></patternFill></fill>`,
        })
      } else {
        fills.set(fillKey, { index, xml: '<fill><patternFill patternType="none"/></fill>' })
      }
    }

    if (!xfs.has(xfKey)) {
      const font = fonts.get(fontKey)!
      const fill = fills.get(fillKey)!
      const applyFont = hasFontFormattingBlock(format) ? ' applyFont="1"' : ''
      const applyFill = format?.backgroundColor ? ' applyFill="1"' : ''
      const applyAlignment = align ? ' applyAlignment="1"' : ''
      const applyNumber = numFmtId !== 0 ? ' applyNumberFormat="1"' : ''
      const alignmentXml = align ? `<alignment horizontal="${align}" vertical="center"/>` : ''
      const index = xfs.size
      xfs.set(xfKey, {
        index,
        xml: `<xf numFmtId="${numFmtId}" fontId="${font.index}" fillId="${fill.index}" borderId="0" xfId="0"${applyFont}${applyFill}${applyAlignment}${applyNumber}>${alignmentXml}</xf>`,
      })
    }

    return xfs.get(xfKey)!.index
  }

  return {
    styleIndexForFormat,
    snapshot: () => ({ fonts, fills, xfs, customNumFmt }),
  }
}

function serializeStylesXmlBlock(stylesBuilder: ReturnType<typeof createStylesBuilderBlock>): string {
  const snapshot = stylesBuilder.snapshot()
  const fonts = [...snapshot.fonts.values()].sort((a, b) => a.index - b.index).map(item => item.xml).join('')
  const fills = [...snapshot.fills.values()].sort((a, b) => a.index - b.index).map(item => item.xml).join('')
  const xfs = [...snapshot.xfs.values()].sort((a, b) => a.index - b.index).map(item => item.xml).join('')
  const numFmtEntries = [...snapshot.customNumFmt.entries()].map(([formatCode, numFmtId]) => (
    `<numFmt numFmtId="${numFmtId}" formatCode="${escapeXmlAttrBlock(formatCode)}"/>`
  ))
  const numFmtXml = numFmtEntries.length > 0
    ? `<numFmts count="${numFmtEntries.length}">${numFmtEntries.join('')}</numFmts>`
    : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${numFmtXml}
  <fonts count="${snapshot.fonts.size}">${fonts}</fonts>
  <fills count="${snapshot.fills.size}">${fills}</fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${snapshot.xfs.size}">${xfs}</cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
}

function resolveNumFmtIdBlock(
  numberFormat: TableCellFormatBlock['numberFormat'] | undefined,
  customNumFmt: Map<string, number>,
): number {
  if (!numberFormat || numberFormat === 'general') return 0
  if (numberFormat === 'number') return 2
  if (numberFormat === 'currency') {
    const code = '$#,##0.00'
    if (!customNumFmt.has(code)) customNumFmt.set(code, 164 + customNumFmt.size)
    return customNumFmt.get(code)!
  }
  if (numberFormat === 'percent') return 10
  if (numberFormat === 'date') return 14
  if (numberFormat === 'text') return 49
  return 0
}

function hasFontFormattingBlock(format: TableCellFormatBlock | undefined): boolean {
  return !!(format?.bold || format?.italic || format?.underline || format?.textColor)
}

function hasFormatBlock(format: TableCellFormatBlock | undefined): boolean {
  return !!(format?.bold || format?.italic || format?.underline || format?.align || format?.textColor || format?.backgroundColor || format?.numberFormat)
}

function toArgbBlock(input: string): string {
  const value = input.trim().replace(/^#/, '')
  if (value.length === 8) return value.toUpperCase()
  if (value.length === 6) return `FF${value.toUpperCase()}`
  return 'FF000000'
}

function normalizeArgbHexBlock(input: string): string {
  const value = input.trim().replace(/^#/, '')
  if (value.length === 8) return `#${value.slice(2).toLowerCase()}`
  if (value.length === 6) return `#${value.toLowerCase()}`
  return '#000000'
}

function parseXmlDocumentBlock(xml: string): Document {
  const parser = new DOMParser()
  return parser.parseFromString(xml, 'application/xml')
}

function findFirstDescendantByLocalNameBlock(root: ParentNode, localName: string): Element | null {
  const all = (root as unknown as Element).getElementsByTagName
    ? (root as unknown as Element).getElementsByTagName('*')
    : []
  for (let i = 0; i < all.length; i++) {
    const node = all[i] as Element
    if (localNameOfBlock(node) === localName) return node
  }
  return null
}

function findAllDescendantsByLocalNameBlock(root: ParentNode, localName: string): Element[] {
  const out: Element[] = []
  const all = (root as unknown as Element).getElementsByTagName
    ? (root as unknown as Element).getElementsByTagName('*')
    : []
  for (let i = 0; i < all.length; i++) {
    const node = all[i] as Element
    if (localNameOfBlock(node) === localName) out.push(node)
  }
  return out
}

function childElementsByLocalNameBlock(parent: Element, localName: string): Element[] {
  const out: Element[] = []
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i]
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const element = child as Element
    if (localNameOfBlock(element) === localName) out.push(element)
  }
  return out
}

function localNameOfBlock(node: Element): string {
  if (node.localName) return node.localName
  const name = node.nodeName || ''
  const parts = name.split(':')
  return parts[parts.length - 1]
}

function escapeXmlBlock(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeXmlAttrBlock(input: string): string {
  return escapeXmlBlock(input).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function decodeCellReferenceBlock(ref: string): { row: number; col: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim())
  if (!match) return null
  const colName = match[1].toUpperCase()
  const row = Math.max(1, parseInt(match[2], 10)) - 1
  let col = 0
  for (let i = 0; i < colName.length; i++) {
    col = col * 26 + (colName.charCodeAt(i) - 64)
  }
  return { row, col: col - 1 }
}

function columnIndexToNameBlock(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function getRequiredTextEntryBlock(entries: Map<string, Uint8Array>, path: string): string {
  const bytes = entries.get(path)
  if (!bytes) throw new Error(`Missing XLSX entry: ${path}`)
  return bytesToUtf8Block(bytes)
}

function unzipEntriesBlock(zipBytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength)
  const eocdOffset = findEocdOffsetBlock(view)
  if (eocdOffset < 0) throw new Error('Invalid XLSX zip: EOCD not found')

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const centralOffset = view.getUint32(eocdOffset + 16, true)
  const out = new Map<string, Uint8Array>()
  let cursor = centralOffset

  for (let i = 0; i < totalEntries; i++) {
    const sig = view.getUint32(cursor, true)
    if (sig !== 0x02014b50) throw new Error('Invalid ZIP central directory record')
    const compressionMethod = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const fileNameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const nameStart = cursor + 46
    const nameEnd = nameStart + fileNameLength
    const name = bytesToUtf8Block(zipBytes.subarray(nameStart, nameEnd))

    const localSig = view.getUint32(localOffset, true)
    if (localSig !== 0x04034b50) throw new Error(`Invalid local header for ${name}`)
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressedData = zipBytes.subarray(dataStart, dataStart + compressedSize)

    let data: Uint8Array
    if (compressionMethod === 0) data = compressedData
    else if (compressionMethod === 8) data = pako.inflateRaw(compressedData)
    else throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`)

    out.set(name, data)
    cursor = nameEnd + extraLength + commentLength
  }
  return out
}

function zipEntriesBlock(entries: ZipEntryBlock[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  const now = new Date()
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((Math.floor(now.getSeconds() / 2)) & 0x1f)
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f)

  for (const entry of entries) {
    const nameBytes = utf8ToBytesBlock(entry.name)
    const compressed = pako.deflateRaw(entry.data)
    const crc = crc32Block(entry.data)
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0, true)
    localView.setUint16(8, 8, true)
    localView.setUint16(10, dosTime, true)
    localView.setUint16(12, dosDate, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, compressed.length, true)
    localView.setUint32(22, entry.data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true)
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, compressed)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0, true)
    centralView.setUint16(10, 8, true)
    centralView.setUint16(12, dosTime, true)
    centralView.setUint16(14, dosDate, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, compressed.length, true)
    centralView.setUint32(24, entry.data.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    offset += localHeader.length + compressed.length
  }

  const centralSize = totalLengthBlock(centralParts)
  const centralOffset = offset
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true)
  eocdView.setUint16(4, 0, true)
  eocdView.setUint16(6, 0, true)
  eocdView.setUint16(8, entries.length, true)
  eocdView.setUint16(10, entries.length, true)
  eocdView.setUint32(12, centralSize, true)
  eocdView.setUint32(16, centralOffset, true)
  eocdView.setUint16(20, 0, true)

  return concatUint8ArraysBlock([...localParts, ...centralParts, eocd])
}

function findEocdOffsetBlock(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22)
  for (let i = view.byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i
  }
  return -1
}

function totalLengthBlock(parts: Uint8Array[]): number {
  let total = 0
  for (const part of parts) total += part.length
  return total
}

function concatUint8ArraysBlock(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(totalLengthBlock(parts))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function crc32Block(data: Uint8Array): number {
  let crc = -1
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE_BLOCK[(crc ^ data[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

const CRC_TABLE_BLOCK: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

const ROOT_RELS_XML_BLOCK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

const APP_XML_BLOCK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Thinking Space</Application>
</Properties>`

const CORE_XML_BLOCK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Thinking Space</dc:creator>
  <cp:lastModifiedBy>Thinking Space</cp:lastModifiedBy>
</cp:coreProperties>`
