import { useEffect, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/lego_blocks/units/ui/card'
import { Button } from '@/components/lego_blocks/units/ui/button'
import SearchDropdown from '@/components/lego_blocks/integrations/SearchDropdownBlock'
import type { CleanResult } from '@/services/lego_blocks/units/typesBlock'
import { listFolders } from '@/services/orchestrators/fileSystemOrch'
import { cleanAndSave, previewTranscript } from '@/services/orchestrators/transcriptCleanerOrch'

export default function TranscriptCleaner() {
  const [transcriptText, setTranscriptText] = useState('')
  const [headingsText, setHeadingsText] = useState('')
  const [folders, setFolders] = useState<string[]>([])
  const [selectedFolder, setSelectedFolder] = useState('')
  const [folderInput, setFolderInput] = useState('')
  const [outputName, setOutputName] = useState('')
  const [preview, setPreview] = useState<CleanResult | null>(null)
  const [loading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listFolders(1000)
      .then((nextFolders) => setFolders(nextFolders))
      .catch(err => setError(err.message))
  }, [])

  useEffect(() => {
    if (!transcriptText.trim()) {
      setPreview(null)
      return
    }

    try {
      const result = previewTranscript(transcriptText, headingsText, { heading_level: 2 })
      setPreview(result)
      setError(result.success ? null : result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [transcriptText, headingsText])

  const handleSave = async () => {
    if (!transcriptText.trim() || !outputName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const result = await cleanAndSave({
        input_text: transcriptText,
        headings_text: headingsText,
        output_folder: outputName,
        output_name: outputName,
        base_folder: (selectedFolder || folderInput).trim() || null,
        options: { heading_level: 2 },
      })
      setPreview(result)
      setError(result.success ? null : result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectFolder = (folder: string) => {
    setSelectedFolder(folder)
    setFolderInput(folder)
  }

  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-medium">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Transcript Cleaner</h1>
              <p className="text-muted-foreground">
                Convert timestamped transcripts into clean, sectioned markdown.
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Input</CardTitle>
              <CardDescription>
                Paste the transcript and heading list, then choose a destination folder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Transcript</label>
                  <textarea
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    placeholder="(0s):\nWelcome..."
                    className="h-72 w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Headings</label>
                  <textarea
                    value={headingsText}
                    onChange={(e) => setHeadingsText(e.target.value)}
                    placeholder="00:00:00 Intro\n00:00:37 Play, Brain & Exploring Contingencies"
                    className="h-72 w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Destination folder</label>
                  <div className="relative">
                    <SearchDropdown
                      items={folders}
                      selected={selectedFolder}
                      onSelect={handleSelectFolder}
                      onInputChange={setFolderInput}
                      allowCustomValue
                      placeholder="Search folders..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Folder name</label>
                  <input
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="Essentials - Using Play to Rewire & Improve Your Brain"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving || !transcriptText.trim() || !outputName.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clean & Save'}
              </Button>
              {preview?.output_path && (
                <div className="text-xs text-muted-foreground">
                  Saved to: <span className="font-medium text-foreground">{preview.output_path}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>Formatted markdown output</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="text-sm text-muted-foreground">Generating preview…</div>
              )}
              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}
              {!loading && !error && (
                <pre className="h-80 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {preview?.preview || 'Paste transcript text to preview.'}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
