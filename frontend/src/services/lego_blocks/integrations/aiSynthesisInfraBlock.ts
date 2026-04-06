import path from 'node:path'

import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  parseMarkdownFrontmatterBlock,
  patchFrontmatterValuesBlock,
  stringifyMarkdownFrontmatterBlock,
} from '@/services/lego_blocks/units/markdownFrontmatterBlock'

export type AISynthesisLayer = 'reference' | 'experiential' | 'operational' | 'integrated'

const AI_SYNTHESIS_ROOT = 'AI Synthesis'
const REQUIRED_AI_SYNTHESIS_FIELDS = [
  'type',
  'domain',
  'layer',
  'synthesis_type',
  'derived_from',
  'last_compiled_at',
  'compile_status',
] as const

const CANONICAL_PAGES = [
  'AI Synthesis/index.md',
  'AI Synthesis/Reference/Concepts/core-concepts.md',
  'AI Synthesis/Experiential/Themes/current-patterns.md',
  'AI Synthesis/Operational/Active Focus/current-focus.md',
  'AI Synthesis/Integrated/Domain Overviews/current-state.md',
  'AI Synthesis/Questions/open-questions.md',
] as const

const LAYER_FOLDER_MAP: Record<AISynthesisLayer, string> = {
  reference: 'Reference',
  experiential: 'Experiential',
  operational: 'Operational',
  integrated: 'Integrated',
}

const SYNTHESIS_PATH_MAP: Record<string, string[]> = {
  source_summary: ['Reference', 'Sources'],
  concept: ['Reference', 'Concepts'],
  entity: ['Reference', 'Entities'],
  theme: ['Reference', 'Themes'],
  timeline: ['Reference', 'Timelines'],
  comparison: ['Reference', 'Themes'],
  pattern: ['Experiential', 'Patterns'],
  belief_state: ['Experiential', 'Beliefs'],
  tension: ['Experiential', 'Tensions'],
  period_summary: ['Experiential', 'Period Summaries'],
  theme_summary: ['Experiential', 'Themes'],
  operational_summary: ['Operational', 'Programs'],
  decision_summary: ['Operational', 'Decisions'],
  focus_summary: ['Operational', 'Active Focus'],
  blocker_summary: ['Operational', 'Blockers'],
  integrated_memo: ['Integrated', 'Bridges'],
  domain_state: ['Integrated', 'Domain Overviews'],
  bridge_note: ['Integrated', 'Bridges'],
  promotion_candidate: ['Integrated', 'Promotion Candidates'],
  question: ['Questions'],
  map: ['Maps'],
  answer: ['Outputs', 'Answers'],
}

const TEMPLATE_HEADINGS: Record<string, string[]> = {
  source_summary: ['Summary', 'Key Ideas', 'Important Entities', 'Related Concepts', 'Open Questions'],
  concept: ['What This Concept Is', 'Why It Matters', 'Supporting Notes', 'Related Entities', 'Open Questions'],
  entity: ['Who Or What This Is', 'Why It Matters', 'Related Concepts', 'Supporting Notes', 'Open Questions'],
  theme: ['Theme', 'Why It Matters', 'Supporting Notes', 'Related Concepts', 'Open Questions'],
  timeline: ['Timeline', 'Important Moments', 'Open Questions'],
  comparison: ['Compared Items', 'Common Ground', 'Important Differences', 'Open Questions'],
  pattern: ['Pattern', 'Evidence', 'What Seems To Drive It', 'Open Questions'],
  belief_state: ['Belief State', 'Evidence', 'Competing Views', 'Open Questions'],
  tension: ['Tension', 'Evidence', 'Why It Matters', 'Open Questions'],
  period_summary: ['Period Summary', 'What Changed', 'What Still Feels Open'],
  theme_summary: ['Theme Summary', 'Evidence', 'Why It Matters', 'Open Questions'],
  operational_summary: ['Operational Summary', 'Active Work', 'Open Questions'],
  decision_summary: ['Decision Summary', 'Inputs', 'Decision State', 'Open Questions'],
  focus_summary: ['Current Focus', 'Active Threads', 'Blockers', 'Next Steps'],
  blocker_summary: ['Blocker', 'Why It Matters', 'Possible Unblocks'],
  integrated_memo: ['Summary', 'Reference Context', 'Experiential Context', 'Operational Context', 'Open Questions'],
  domain_state: ['What The World Says', 'What Anurag Seems To Think', 'What Is Active Right Now', 'Tensions', 'Open Questions', 'Promotion Candidates'],
  bridge_note: ['Bridge', 'Why These Notes Connect', 'Implications', 'Open Questions'],
  promotion_candidate: ['Candidate', 'Why It Should Be Promoted', 'Supporting Notes'],
  question: ['Question', 'Why It Matters', 'Related Notes', 'Possible Next Step'],
  map: ['Map', 'Important Nodes', 'Important Connections'],
  answer: ['Answer', 'Supporting Notes', 'Follow-Up Questions'],
}

export interface ReadNoteBlockResult {
  path: string
  exists: boolean
  frontmatter: Record<string, unknown>
  body: string
  raw: string
}

export async function readNoteBlock(fs: VaultFS, notePath: string): Promise<ReadNoteBlockResult> {
  const normalizedPath = normalizeVaultPathBlock(notePath)
  if (!(await fs.exists(normalizedPath))) {
    return {
      path: normalizedPath,
      exists: false,
      frontmatter: {},
      body: '',
      raw: '',
    }
  }

  const raw = await fs.read(normalizedPath)
  const parsed = parseMarkdownFrontmatterBlock(raw)
  return {
    path: normalizedPath,
    exists: true,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    raw,
  }
}

export async function writeNoteBlock(
  fs: VaultFS,
  input: {
    path: string
    frontmatter?: Record<string, unknown>
    body?: string
    overwrite?: boolean
  },
): Promise<{
  path: string
  written: true
  created: boolean
  frontmatter: Record<string, unknown>
  body: string
}> {
  const normalizedPath = normalizeVaultPathBlock(input.path)
  const exists = await fs.exists(normalizedPath)
  if (exists && !input.overwrite) {
    throw new Error(`File already exists: ${normalizedPath}. Pass overwrite=true to replace it.`)
  }

  const body = (input.body ?? '').replace(/\r\n/g, '\n')
  const frontmatter = { ...(input.frontmatter ?? {}) }
  const raw = stringifyMarkdownFrontmatterBlock({ frontmatter, body })
  await fs.write(normalizedPath, raw)

  return {
    path: normalizedPath,
    written: true,
    created: !exists,
    frontmatter,
    body,
  }
}

export async function patchNoteFrontmatterBlock(
  fs: VaultFS,
  input: {
    path: string
    set?: Record<string, unknown>
    append_unique?: Record<string, unknown>
  },
): Promise<{
  path: string
  patched: true
  frontmatter: Record<string, unknown>
}> {
  const existing = await readNoteBlock(fs, input.path)
  if (!existing.exists) throw new Error(`Note not found: ${existing.path}`)

  const nextFrontmatter = patchFrontmatterValuesBlock(existing.frontmatter, {
    set: input.set,
    appendUnique: input.append_unique,
  })
  const raw = stringifyMarkdownFrontmatterBlock({
    frontmatter: nextFrontmatter,
    body: existing.body,
  })
  await fs.write(existing.path, raw)

  return {
    path: existing.path,
    patched: true,
    frontmatter: nextFrontmatter,
  }
}

export async function resolveAiSynthesisPathBlock(
  _fs: VaultFS,
  input: {
    domain_root: string
    layer?: AISynthesisLayer
    synthesis_type: string
    source_title?: string
    concept_root?: string
    concept_subpath?: string[]
    slug: string
  },
): Promise<{
  path: string
  domain_root: string
  domain: string
}> {
  const domainRoot = normalizeVaultPathBlock(input.domain_root)
  const folderSegments = resolveSynthesisFolderSegmentsBlock(input)
  const slug = normalizeSlugBlock(input.slug)
  if (!slug) throw new Error('slug is required')

  return {
    path: joinVaultPathBlock(domainRoot, AI_SYNTHESIS_ROOT, ...folderSegments, `${slug}.md`),
    domain_root: domainRoot,
    domain: domainSlugFromRootBlock(domainRoot),
  }
}

export async function createAiSynthesisNoteBlock(
  fs: VaultFS,
  input: {
    domain_root: string
    layer: AISynthesisLayer
    synthesis_type: string
    title?: string
    slug?: string
    source_title?: string
    concept_root?: string
    concept_subpath?: string[]
    derived_from: string[]
    if_exists?: 'error' | 'return_existing' | 'overwrite'
  },
): Promise<{
    created: boolean
    path: string
    frontmatter: Record<string, unknown>
    body: string
  }> {
  const title = (input.title ?? '').trim() || buildDefaultTitleBlock(input.synthesis_type, input.slug)
  const slug = normalizeSlugBlock(input.slug || title)
  if (!slug) throw new Error('title or slug is required')

  const resolved = await resolveAiSynthesisPathBlock(fs, {
    domain_root: input.domain_root,
    layer: input.layer,
    synthesis_type: input.synthesis_type,
    source_title: input.source_title,
    concept_root: input.concept_root,
    concept_subpath: input.concept_subpath,
    slug,
  })

  const ifExists = input.if_exists ?? 'return_existing'
  const existing = await readNoteBlock(fs, resolved.path)
  if (existing.exists && ifExists === 'return_existing') {
    return {
      created: false,
      path: existing.path,
      frontmatter: existing.frontmatter,
      body: existing.body,
    }
  }
  if (existing.exists && ifExists === 'error') {
    throw new Error(`AI synthesis note already exists: ${existing.path}`)
  }

  const now = new Date().toISOString()
  const frontmatter: Record<string, unknown> = {
    title,
    type: 'ai_synthesis',
    domain: resolved.domain,
    layer: input.layer,
    synthesis_type: input.synthesis_type,
    derived_from: uniqueStringsBlock(input.derived_from.map(normalizeVaultPathBlock)),
    last_compiled_at: now,
    compile_status: 'stub',
    promotion_status: 'none',
    related_notes: [],
    related_entities: [],
    related_concepts: [],
    coverage: [],
    open_questions: [],
    summary: '',
  }
  const body = renderTemplateBodyBlock(title, input.synthesis_type)
  await writeNoteBlock(fs, {
    path: resolved.path,
    frontmatter,
    body,
    overwrite: ifExists === 'overwrite',
  })

  return {
    created: true,
    path: resolved.path,
    frontmatter,
    body,
  }
}

export async function getImpactedAiSynthesisNotesBlock(
  fs: VaultFS,
  input: {
    changed_paths: string[]
  },
): Promise<{
  domain_root: string
  likely_impacted: string[]
  missing_candidates: string[]
}> {
  const changedPaths = uniqueStringsBlock(input.changed_paths.map(normalizeVaultPathBlock))
  if (changedPaths.length === 0) throw new Error('changed_paths is required')

  const resolvedRoots = await Promise.all(changedPaths.map(changedPath => resolveDomainRootForPathBlock(fs, changedPath)))
  const domainRoots = uniqueStringsBlock(resolvedRoots.filter((value): value is string => Boolean(value)))
  if (domainRoots.length !== 1) {
    throw new Error(`changed_paths must resolve to a single domain root. Got: ${domainRoots.join(', ') || '(none)'}`)
  }

  const domainRoot = domainRoots[0]!
  const aiRoot = joinVaultPathBlock(domainRoot, AI_SYNTHESIS_ROOT)
  const notes = await listMarkdownNotesUnderBlock(fs, aiRoot)
  const impacted = new Set<string>()

  for (const note of notes) {
    const derivedFrom = normalizeStringArrayBlock(note.frontmatter.derived_from)
    if (derivedFrom.some(source => changedPaths.includes(source))) {
      impacted.add(note.path)
      continue
    }
    if (changedPaths.includes(note.path)) {
      impacted.add(note.path)
      continue
    }
  }

  for (const changedPath of changedPaths) {
    const layer = await inferLayerForPathBlock(fs, changedPath)
    const canonicalForLayer = layer ? canonicalPagesForLayerBlock(domainRoot, layer) : []
    for (const candidate of canonicalForLayer) {
      if (!(await fs.exists(candidate))) impacted.add(candidate)
    }
  }

  const missingCandidates: string[] = []
  for (const canonical of canonicalPathsForDomainBlock(domainRoot)) {
    if (await fs.exists(canonical)) continue
    missingCandidates.push(canonical)
  }

  return {
    domain_root: domainRoot,
    likely_impacted: [...impacted].sort(),
    missing_candidates: uniqueStringsBlock(missingCandidates).sort(),
  }
}

export async function updateAiSynthesisCompileStateBlock(
  fs: VaultFS,
  input: {
    path: string
    last_compiled_at?: string
    compile_status: string
  },
): Promise<{
  path: string
  updated: true
  frontmatter: Record<string, unknown>
}> {
  return patchNoteFrontmatterBlock(fs, {
    path: input.path,
    set: {
      last_compiled_at: input.last_compiled_at ?? new Date().toISOString(),
      compile_status: input.compile_status,
    },
  }).then(result => ({
    path: result.path,
    updated: true,
    frontmatter: result.frontmatter,
  }))
}

export async function listDomainAiSynthesisHealthBlock(
  fs: VaultFS,
  input: {
    domain_root: string
  },
): Promise<{
  domain_root: string
  missing_canonical_pages: string[]
  stale_pages: string[]
  missing_required_metadata: Array<{ path: string; missing_fields: string[] }>
  unanswered_questions: string[]
  orphan_outputs: string[]
}> {
  const domainRoot = normalizeVaultPathBlock(input.domain_root)
  const aiRoot = joinVaultPathBlock(domainRoot, AI_SYNTHESIS_ROOT)
  const notes = await listMarkdownNotesUnderBlock(fs, aiRoot)

  const missingCanonicalPages: string[] = []
  for (const candidate of canonicalPathsForDomainBlock(domainRoot)) {
    if (!(await fs.exists(candidate))) missingCanonicalPages.push(candidate)
  }

  const stalePages: string[] = []
  const missingRequiredMetadata: Array<{ path: string; missing_fields: string[] }> = []
  const unansweredQuestions: string[] = []
  const questionLinksToOutputs = new Set<string>()
  const outputPaths = new Set<string>()

  for (const note of notes) {
    const synthesisType = asTrimmedStringBlock(note.frontmatter.synthesis_type)
    const compileStatus = asTrimmedStringBlock(note.frontmatter.compile_status)
    const missingFields = REQUIRED_AI_SYNTHESIS_FIELDS.filter((field) => isMissingMechanicalFieldBlock(note.frontmatter[field]))
    if (Array.isArray(note.frontmatter.derived_from) && note.frontmatter.derived_from.length === 0) {
      if (!missingFields.includes('derived_from')) missingFields.push('derived_from')
    }

    if (missingFields.length > 0) {
      missingRequiredMetadata.push({
        path: note.path,
        missing_fields: missingFields,
      })
    }

    if (compileStatus === 'stale' || compileStatus === 'needs_review') {
      stalePages.push(note.path)
    }

    if (isQuestionNoteBlock(note.path, synthesisType, note.frontmatter)) {
      if (!isAnsweredQuestionBlock(note.frontmatter)) unansweredQuestions.push(note.path)
      for (const linkedOutput of collectOutputLinksBlock(note.frontmatter)) {
        questionLinksToOutputs.add(linkedOutput)
      }
    }

    if (note.path.startsWith(joinVaultPathBlock(aiRoot, 'Outputs'))) {
      outputPaths.add(note.path)
    }
  }

  const orphanOutputs = [...outputPaths].filter(outputPath => !questionLinksToOutputs.has(outputPath)).sort()

  return {
    domain_root: domainRoot,
    missing_canonical_pages: missingCanonicalPages.sort(),
    stale_pages: stalePages.sort(),
    missing_required_metadata: missingRequiredMetadata.sort((left, right) => left.path.localeCompare(right.path)),
    unanswered_questions: unansweredQuestions.sort(),
    orphan_outputs: orphanOutputs,
  }
}

interface ParsedVaultNote {
  path: string
  frontmatter: Record<string, unknown>
  body: string
}

async function listMarkdownNotesUnderBlock(fs: VaultFS, rootPath: string): Promise<ParsedVaultNote[]> {
  const normalizedRoot = normalizeVaultPathBlock(rootPath)
  const entries = await fs.walkVault(['.md'])
  const notes: ParsedVaultNote[] = []
  for (const entry of entries) {
    const normalizedPath = normalizeVaultPathBlock(entry.path)
    if (!(normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`))) continue
    const raw = await fs.read(normalizedPath)
    const parsed = parseMarkdownFrontmatterBlock(raw)
    notes.push({
      path: normalizedPath,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
    })
  }
  return notes
}

async function inferLayerForPathBlock(fs: VaultFS, notePath: string): Promise<AISynthesisLayer | null> {
  const normalizedPath = normalizeVaultPathBlock(notePath)
  if (normalizedPath.includes('/AI Synthesis/Reference/')) return 'reference'
  if (normalizedPath.includes('/AI Synthesis/Experiential/')) return 'experiential'
  if (normalizedPath.includes('/AI Synthesis/Operational/')) return 'operational'
  if (normalizedPath.includes('/AI Synthesis/Integrated/')) return 'integrated'

  if (await fs.exists(normalizedPath)) {
    try {
      const raw = await fs.read(normalizedPath)
      const parsed = parseMarkdownFrontmatterBlock(raw)
      const layer = asTrimmedStringBlock(parsed.frontmatter.layer) as AISynthesisLayer | null
      if (layer && ['reference', 'experiential', 'operational', 'integrated'].includes(layer)) {
        return layer as AISynthesisLayer
      }
      const kind = asTrimmedStringBlock(parsed.frontmatter.kind)
      if (kind === 'thought') return 'experiential'
      if (kind === 'task' || kind === 'todo') return 'operational'
      if (kind === 'reference') return 'reference'
    } catch {
      // Fall through to path heuristics.
    }
  }

  const lowered = normalizedPath.toLowerCase()
  if (lowered.includes('/thoughts/')) return 'experiential'
  if (lowered.includes('/thinking-organizer/') || lowered.includes('/todos/')) return 'operational'
  return 'reference'
}

async function resolveDomainRootForPathBlock(fs: VaultFS, notePath: string): Promise<string | null> {
  const normalizedPath = normalizeVaultPathBlock(notePath)
  const segments = normalizedPath.split('/').filter(Boolean)
  const aiIndex = segments.indexOf(AI_SYNTHESIS_ROOT)
  if (aiIndex > 0) return segments.slice(0, aiIndex).join('/')

  let cursor = normalizedPath.includes('.')
    ? path.posix.dirname(normalizedPath)
    : normalizedPath
  while (cursor && cursor !== '.') {
    const candidate = joinVaultPathBlock(cursor, AI_SYNTHESIS_ROOT)
    if (await fs.exists(candidate)) return cursor
    cursor = path.posix.dirname(cursor)
    if (cursor === '.' || cursor === '/') break
  }

  if (segments.length >= 2) return `${segments[0]}/${segments[1]}`
  if (segments.length === 1) return segments[0]
  return null
}

function resolveSynthesisFolderSegmentsBlock(input: {
  layer?: AISynthesisLayer
  synthesis_type: string
  source_title?: string
  concept_root?: string
  concept_subpath?: string[]
}): string[] {
  if (input.synthesis_type === 'source_summary' && input.source_title) {
    return ['Reference', 'Sources', normalizeFolderTitleBlock(input.source_title)]
  }

  if (input.synthesis_type === 'concept' && input.concept_root) {
    const conceptSegments = [
      'Reference',
      'Concepts',
      normalizeFolderTitleBlock(input.concept_root),
      ...normalizeFolderSegmentsBlock(input.concept_subpath),
    ]
    return conceptSegments
  }

  const mapped = SYNTHESIS_PATH_MAP[input.synthesis_type]
  if (mapped) return mapped
  if (input.layer) return [LAYER_FOLDER_MAP[input.layer]]
  throw new Error(`Unsupported synthesis_type without layer fallback: ${input.synthesis_type}`)
}

function canonicalPathsForDomainBlock(domainRoot: string): string[] {
  return CANONICAL_PAGES.map(relativePath => joinVaultPathBlock(domainRoot, relativePath))
}

function canonicalPagesForLayerBlock(domainRoot: string, layer: AISynthesisLayer): string[] {
  const byLayer: Record<AISynthesisLayer, string[]> = {
    reference: [
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Reference/Concepts/core-concepts.md'),
      joinVaultPathBlock(domainRoot, 'AI Synthesis/index.md'),
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Questions/open-questions.md'),
    ],
    experiential: [
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Experiential/Themes/current-patterns.md'),
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Integrated/Domain Overviews/current-state.md'),
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Questions/open-questions.md'),
    ],
    operational: [
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Operational/Active Focus/current-focus.md'),
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Integrated/Domain Overviews/current-state.md'),
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Questions/open-questions.md'),
    ],
    integrated: [
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Integrated/Domain Overviews/current-state.md'),
      joinVaultPathBlock(domainRoot, 'AI Synthesis/Questions/open-questions.md'),
      joinVaultPathBlock(domainRoot, 'AI Synthesis/index.md'),
    ],
  }
  return byLayer[layer]
}

function isMissingMechanicalFieldBlock(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

function isQuestionNoteBlock(notePath: string, synthesisType: string | null, frontmatter: Record<string, unknown>): boolean {
  if (synthesisType === 'question') return true
  if (notePath.includes('/AI Synthesis/Questions/')) return true
  return asTrimmedStringBlock(frontmatter.type) === 'question'
}

function isAnsweredQuestionBlock(frontmatter: Record<string, unknown>): boolean {
  if (frontmatter.answered === true || frontmatter.resolved === true) return true
  const answerPath = asTrimmedStringBlock(frontmatter.answer_path)
  if (answerPath) return true
  const answerPaths = normalizeStringArrayBlock(frontmatter.answer_paths)
  if (answerPaths.length > 0) return true
  const outputPaths = normalizeStringArrayBlock(frontmatter.output_paths)
  if (outputPaths.length > 0) return true
  return false
}

function collectOutputLinksBlock(frontmatter: Record<string, unknown>): string[] {
  const paths = [
    ...normalizeStringArrayBlock(frontmatter.answer_paths),
    ...normalizeStringArrayBlock(frontmatter.output_paths),
  ]
  const answerPath = asTrimmedStringBlock(frontmatter.answer_path)
  if (answerPath) paths.push(answerPath)
  return uniqueStringsBlock(paths.map(normalizeVaultPathBlock))
}

function renderTemplateBodyBlock(title: string, synthesisType: string): string {
  const headings = TEMPLATE_HEADINGS[synthesisType] ?? ['Summary', 'Supporting Notes', 'Open Questions']
  const sections = [`# ${title}`]
  for (const heading of headings) {
    sections.push('', `## ${heading}`, '')
  }
  return sections.join('\n').trimEnd()
}

function buildDefaultTitleBlock(synthesisType: string, rawSlug?: string): string {
  const slug = normalizeSlugBlock(rawSlug ?? synthesisType)
  const human = slug
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  const typeLabel = synthesisType
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return human ? `${typeLabel} - ${human}` : typeLabel
}

function domainSlugFromRootBlock(domainRoot: string): string {
  const basename = domainRoot.split('/').filter(Boolean).pop() ?? domainRoot
  return normalizeSlugBlock(basename)
}

function normalizeSlugBlock(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeFolderTitleBlock(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, ' ')
    .replace(/\//g, '-')
    .trim()
}

function normalizeFolderSegmentsBlock(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return []
  return values
    .map(normalizeFolderTitleBlock)
    .filter(Boolean)
}

function normalizeVaultPathBlock(value: string): string {
  const normalized = path.posix.normalize(String(value || '').replace(/\\/g, '/'))
  return normalized
    .replace(/^\/+/, '')
    .replace(/\/+$/g, '')
    .replace(/^\.\//, '')
    .replace(/^$/, '')
}

function joinVaultPathBlock(...parts: string[]): string {
  return normalizeVaultPathBlock(parts.filter(Boolean).join('/'))
}

function uniqueStringsBlock(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function asTrimmedStringBlock(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeStringArrayBlock(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return uniqueStringsBlock(value.map(item => String(item)))
}
