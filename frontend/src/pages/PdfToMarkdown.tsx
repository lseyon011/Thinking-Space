import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/lego_blocks/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/lego_blocks/ui/card'
import { Switch } from '@/components/lego_blocks/ui/switch'
import { ArrowLeft, FileType, Check, Loader2, Search } from 'lucide-react'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import type { ConvertOptions, PdfPreviewData, PdfConvertResult } from '@/services/lego_blocks/typesBlock'
import type { CapabilityActor } from '@/services/lego_blocks/capabilityRegistryBlock'
import { rankFuzzyItemsBlock } from '@/services/lego_blocks/fuzzySearchBlock'

const PDF_ACTOR: CapabilityActor = { kind: 'human', id: 'ui.tools.pdf' }

export default function PdfToMarkdown() {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [options, setOptions] = useState<ConvertOptions>({
    preserve_layout: true,
    page_breaks: true,
  })
  const [preview, setPreview] = useState<PdfPreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [result, setResult] = useState<PdfConvertResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files.slice(0, 50)
    const ranked = rankFuzzyItemsBlock({
      items: files,
      query: searchQuery,
      limit: 50,
      getCandidates: (filePath) => {
        const baseName = filePath.split('/').pop() ?? filePath
        return [baseName, filePath]
      },
    })
    return ranked.map(entry => entry.item)
  }, [files, searchQuery])

  // Load file list on mount
  useEffect(() => {
    invokeCapabilityOrThrow({
      capability: 'tools.files.list_pdf',
      input: { limit: 500 },
      actor: PDF_ACTOR,
    })
      .then(({ files }) => setFiles(files))
      .catch(err => setError(err.message))
  }, [])

  // Load preview when file or options change
  useEffect(() => {
    if (!selectedFile) {
      setPreview(null)
      return
    }

    setLoading(true)
    setResult(null)
    setError(null)

    invokeCapabilityOrThrow({
      capability: 'tools.pdf.preview',
      input: { inputPath: selectedFile, options },
      actor: PDF_ACTOR,
    })
      .then(({ preview }) => setPreview(preview))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedFile, options])

  const handleConvert = async () => {
    if (!selectedFile) return

    setConverting(true)
    setError(null)
    setResult(null)

    try {
      const { result } = await invokeCapabilityOrThrow({
        capability: 'tools.pdf.convert',
        input: { inputPath: selectedFile, options },
        actor: PDF_ACTOR,
      })
      setResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setConverting(false)
    }
  }

  const toggleOption = (key: keyof ConvertOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSelectFile = (file: string) => {
    setSelectedFile(file)
    setSearchQuery(file)
    setShowDropdown(false)
  }

  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-narrow">
        {/* Header */}
        <header className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileType className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                PDF to Markdown
              </h1>
              <p className="text-muted-foreground">
                Convert PDF files to markdown format
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6">
          {/* File Selection with Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select PDF</CardTitle>
              <CardDescription>
                Search and choose a PDF file from your vault
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowDropdown(true)
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search PDF files..."
                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>

                {showDropdown && filteredFiles.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-64 overflow-auto rounded-lg border bg-background shadow-lg">
                    {filteredFiles.map(file => (
                      <button
                        key={file}
                        onClick={() => handleSelectFile(file)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                          file === selectedFile ? 'bg-accent' : ''
                        }`}
                      >
                        {file}
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && filteredFiles.length === 0 && searchQuery && (
                  <div className="absolute z-50 w-full mt-1 p-3 rounded-lg border bg-background shadow-lg text-sm text-muted-foreground">
                    No PDF files found
                  </div>
                )}

                {showDropdown && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  />
                )}
              </div>

              {selectedFile && (
                <div className="mt-3 text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{selectedFile}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Preserve layout</div>
                  <div className="text-sm text-muted-foreground">
                    Try to maintain the original text layout
                  </div>
                </div>
                <Switch
                  checked={options.preserve_layout}
                  onCheckedChange={() => toggleOption('preserve_layout')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Page breaks</div>
                  <div className="text-sm text-muted-foreground">
                    Add horizontal rules between pages
                  </div>
                </div>
                <Switch
                  checked={options.page_breaks}
                  onCheckedChange={() => toggleOption('page_breaks')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {selectedFile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
                {preview && (
                  <CardDescription>
                    {preview.page_count} pages, {preview.total_chars.toLocaleString()} characters
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Converting PDF...
                  </div>
                ) : preview ? (
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                    {preview.preview}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a PDF to preview
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {result?.success && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Check className="h-4 w-4" />
                Converted {result.page_count} pages to markdown
              </div>
              <div className="mt-2 text-green-600">
                Saved to: <span className="font-mono">{result.output_path}</span>
              </div>
            </div>
          )}

          {/* Action */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleConvert}
            disabled={!selectedFile || converting}
          >
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Converting...
              </>
            ) : (
              'Convert & Save'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
