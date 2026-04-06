import { Capacitor, registerPlugin } from '@capacitor/core'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import { type MarkdownAnnotationStrokeBlock } from '@/services/lego_blocks/units/markdownAnnotationBlock'
import {
  buildMarkdownAnnotationOcrCanvasDataUrlBlock,
  type MarkdownAnnotationOcrResultBlock,
} from '@/services/lego_blocks/units/markdownAnnotationOcrBlock'

interface InkRecognitionPluginDef {
  recognizeInk(params: {
    imageDataUrl: string
  }): Promise<{
    text: string
  }>
}

const InkRecognition = registerPlugin<InkRecognitionPluginDef>('InkRecognition')

function getOcrRuntimeState() {
  const native = isCapacitorNative()
  if (!native) {
    return {
      isCapacitorNative: false,
      platform: 'web',
    }
  }
  try {
    return {
      isCapacitorNative: true,
      platform: Capacitor.getPlatform(),
    }
  } catch {
    return {
      isCapacitorNative: true,
      platform: 'unknown',
    }
  }
}

export function isMarkdownAnnotationOcrSupportedOrch(): boolean {
  const runtime = getOcrRuntimeState()
  return runtime.isCapacitorNative && runtime.platform === 'ios'
}

export async function recognizeMarkdownAnnotationInkOrch(
  strokes: MarkdownAnnotationStrokeBlock[],
): Promise<MarkdownAnnotationOcrResultBlock> {
  if (!isMarkdownAnnotationOcrSupportedOrch()) {
    throw new Error('On-device handwriting recognition is currently available on iOS only.')
  }
  if (strokes.length === 0) {
    throw new Error('Add some ink before running handwriting recognition.')
  }

  const imageDataUrl = buildMarkdownAnnotationOcrCanvasDataUrlBlock(strokes)
  if (!imageDataUrl) {
    throw new Error('Failed to rasterize ink for recognition.')
  }

  const result = await InkRecognition.recognizeInk({ imageDataUrl })
  return {
    text: typeof result.text === 'string' ? result.text.trim() : '',
  }
}
