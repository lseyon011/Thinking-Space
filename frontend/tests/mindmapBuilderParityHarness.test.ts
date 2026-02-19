import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildMindmapSceneFromMarkdownBlock,
  DEFAULT_MINDMAP_BUILD_OPTIONS,
} from '../src/services/lego_blocks/mindmapBuilderBlock'
import {
  parseExcalidrawScene,
  type ParsedExcalidrawScene,
} from '../src/services/lego_blocks/excalidrawFileBlock'
import {
  canonicalizeScene,
  diffScenesParityFocused,
  diffScenesStrict,
} from './helpers/excalidrawSceneParity'

const LOCAL_FIXTURE_DIR = path.resolve(
  __dirname,
  'fixtures/excalidraw',
)
const LOCAL_INPUT_PATH = path.join(LOCAL_FIXTURE_DIR, 'mindmap-parity-input.md')
const LOCAL_EXPECTED_PATH = path.join(LOCAL_FIXTURE_DIR, 'mindmap-parity-expected.excalidraw.json')

const EXTERNAL_FIXTURE_DIR = process.env.EXCALIDRAW_PARITY_FIXTURE_DIR
  ?? '/Users/patila06/Library/Mobile Documents/iCloud~md~obsidian/Documents/Long Term Memory iCloud/excalidraw-testfiles'
const EXTERNAL_INPUT_PATH = path.join(EXTERNAL_FIXTURE_DIR, 'Chris Miller - Chip War (formatted for excalidraw).md')
const EXTERNAL_EXPECTED_PATH = path.join(EXTERNAL_FIXTURE_DIR, 'Chris Miller - Chip War.excalidraw.md')

function buildSceneFromMarkdown(markdown: string, sourcePath: string): ParsedExcalidrawScene {
  return buildMindmapSceneFromMarkdownBlock(
    markdown,
    sourcePath,
    {
      ...DEFAULT_MINDMAP_BUILD_OPTIONS,
      includeFullText: true,
      growthMode: 'right-left',
      arrowType: 'curved',
    },
  ).scene
}

describe('mindmapBuilder parity harness', () => {
  it('is deterministic across repeated generation for the same markdown input', () => {
    const markdown = readFileSync(LOCAL_INPUT_PATH, 'utf8')
    const first = buildSceneFromMarkdown(markdown, 'fixtures/mindmap-parity-input.md')
    const second = buildSceneFromMarkdown(markdown, 'fixtures/mindmap-parity-input.md')
    expect(canonicalizeScene(first)).toEqual(canonicalizeScene(second))
  })

  it('matches local golden scene fixture with strict scene diff', () => {
    const markdown = readFileSync(LOCAL_INPUT_PATH, 'utf8')
    const actual = buildSceneFromMarkdown(markdown, 'fixtures/mindmap-parity-input.md')
    const expectedRaw = readFileSync(LOCAL_EXPECTED_PATH, 'utf8')
    const expectedParsed = parseExcalidrawScene(expectedRaw)

    expect(expectedParsed).not.toBeNull()
    const diffs = diffScenesStrict(actual, expectedParsed as ParsedExcalidrawScene)
    expect(diffs).toEqual([])
  })

  it.skipIf(process.env.RUN_EXTERNAL_EXCALIDRAW_PARITY !== '1')(
    'supports parity-focused checks against external excalidraw-testfiles fixture pair',
    () => {
      expect(existsSync(EXTERNAL_INPUT_PATH)).toBe(true)
      expect(existsSync(EXTERNAL_EXPECTED_PATH)).toBe(true)

      const markdown = readFileSync(EXTERNAL_INPUT_PATH, 'utf8')
      const expectedRaw = readFileSync(EXTERNAL_EXPECTED_PATH, 'utf8')
      const expectedParsed = parseExcalidrawScene(expectedRaw)

      expect(expectedParsed).not.toBeNull()
      const actual = buildSceneFromMarkdown(markdown, EXTERNAL_INPUT_PATH)
      const diffs = diffScenesParityFocused(actual, expectedParsed as ParsedExcalidrawScene)
      expect(diffs).toEqual([])
    },
  )
})
