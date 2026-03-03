import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  imageDocumentMimeFromPathBlock,
  isHeicImagePathBlock,
} from '@/services/lego_blocks/units/imageDocumentPathBlock'

interface ImageDocumentBlockProps {
  path: string
  className?: string
}

export default function ImageDocumentBlock({ path, className }: ImageDocumentBlockProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convertedFromHeic, setConvertedFromHeic] = useState(false)
  const isHeicImage = useMemo(() => isHeicImagePathBlock(path), [path])

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    const loadImage = async () => {
      setLoading(true)
      setError(null)
      setImageUrl(null)
      setConvertedFromHeic(false)

      try {
        const fs = getVaultFS()
        const bytes = await fs.readBytes(path)
        const normalizedBytes = Uint8Array.from(bytes)
        let blob = new Blob([normalizedBytes], { type: imageDocumentMimeFromPathBlock(path) })

        if (isHeicImage) {
          const { default: heic2any } = await import('heic2any')
          const converted = await heic2any({
            blob,
            toType: 'image/png',
          })
          blob = Array.isArray(converted) ? converted[0] : converted
          setConvertedFromHeic(true)
        }

        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setImageUrl(objectUrl)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load image.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadImage()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isHeicImage, path])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/60 bg-muted/20 p-3">
        {loading && (
          <div className="flex h-full min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading image...
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full min-h-[40vh] items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && imageUrl && (
          <div className="flex min-h-full items-center justify-center">
            <img
              src={imageUrl}
              alt={path.split('/').pop() || 'image'}
              className="max-h-[78vh] w-auto max-w-full rounded-lg border border-border/50 bg-background object-contain shadow-sm"
            />
          </div>
        )}

        {!loading && !error && !imageUrl && (
          <div className="flex h-full min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            No image data available.
          </div>
        )}
      </div>

      {convertedFromHeic && (
        <div className="mt-2 text-xs text-muted-foreground">
          HEIC/HEIF converted to PNG for preview.
        </div>
      )}
    </div>
  )
}
