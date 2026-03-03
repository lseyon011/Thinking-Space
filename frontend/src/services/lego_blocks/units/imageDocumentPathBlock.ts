const IMAGE_EXTENSION_TO_MIME_BLOCK: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
}

export function isImageDocumentPathBlock(path: string): boolean {
  return Object.keys(IMAGE_EXTENSION_TO_MIME_BLOCK).some((extension) =>
    path.toLowerCase().endsWith(extension),
  )
}

export function imageDocumentMimeFromPathBlock(path: string): string {
  const lowerPath = path.toLowerCase()
  for (const [extension, mime] of Object.entries(IMAGE_EXTENSION_TO_MIME_BLOCK)) {
    if (lowerPath.endsWith(extension)) return mime
  }
  return 'application/octet-stream'
}

export function isHeicImagePathBlock(path: string): boolean {
  return /\.(heic|heif)$/i.test(path)
}
