import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import type { CanvasTile } from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'

export interface CanvasStorageAdapter {
  read(): Promise<CanvasTile[] | null>
  write(tiles: CanvasTile[]): Promise<void>
}

interface CanvasFile {
  version: number
  tiles: CanvasTile[]
}

export interface CanvasStorageConfig {
  /** Vault-relative path for the JSON file (e.g. `.thinking-space/home-canvas.json`). */
  path: string
  /** Vault-relative directory ensured before write (e.g. `.thinking-space`). */
  dir: string
  /** Schema version; reads reject mismatched files (returns null → seeds kick in). */
  version: number
}

export function createCanvasStorageAdapter(config: CanvasStorageConfig): CanvasStorageAdapter {
  return {
    async read(): Promise<CanvasTile[] | null> {
      try {
        const fs = getVaultFS()
        if (!(await fs.exists(config.path))) return null
        const raw = await fs.read(config.path)
        const parsed = JSON.parse(raw) as CanvasFile
        if (!parsed || parsed.version !== config.version) return null
        if (!Array.isArray(parsed.tiles)) return null
        return parsed.tiles
      } catch {
        return null
      }
    },
    async write(tiles: CanvasTile[]): Promise<void> {
      const fs = getVaultFS()
      await fs.mkdir(config.dir)
      const payload: CanvasFile = { version: config.version, tiles }
      await fs.write(config.path, JSON.stringify(payload, null, 2))
    },
  }
}
