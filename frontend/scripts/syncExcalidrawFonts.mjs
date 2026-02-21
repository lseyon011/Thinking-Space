import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(scriptDir, '..')
const sourceDir = resolve(frontendRoot, 'node_modules', '@excalidraw', 'excalidraw', 'dist', 'prod', 'fonts')
const targetDir = resolve(frontendRoot, 'public', 'fonts')

if (!existsSync(sourceDir)) {
  throw new Error(
    `[syncExcalidrawFonts] source fonts directory not found: ${sourceDir}. Run npm install in frontend first.`
  )
}

mkdirSync(resolve(frontendRoot, 'public'), { recursive: true })
rmSync(targetDir, { recursive: true, force: true })
cpSync(sourceDir, targetDir, { recursive: true })

console.log('[syncExcalidrawFonts] synced Excalidraw fonts to public/fonts')
