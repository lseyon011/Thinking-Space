import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  createAiSynthesisNoteBlock,
  getImpactedAiSynthesisNotesBlock,
  listDomainAiSynthesisHealthBlock,
  patchNoteFrontmatterBlock,
  readNoteBlock,
  resolveAiSynthesisPathBlock,
  updateAiSynthesisCompileStateBlock,
  writeNoteBlock,
  type AISynthesisLayer,
} from '@/services/lego_blocks/integrations/aiSynthesisInfraBlock'

export type { AISynthesisLayer }

export async function readNoteOrch(fs: VaultFS, path: string) {
  return readNoteBlock(fs, path)
}

export async function writeNoteOrch(
  fs: VaultFS,
  input: {
    path: string
    frontmatter?: Record<string, unknown>
    body?: string
    overwrite?: boolean
  },
) {
  return writeNoteBlock(fs, input)
}

export async function patchNoteFrontmatterOrch(
  fs: VaultFS,
  input: {
    path: string
    set?: Record<string, unknown>
    append_unique?: Record<string, unknown>
  },
) {
  return patchNoteFrontmatterBlock(fs, input)
}

export async function resolveAiSynthesisPathOrch(
  fs: VaultFS,
  input: {
    domain_root: string
    layer?: AISynthesisLayer
    synthesis_type: string
    source_title?: string
    concept_root?: string
    concept_subpath?: string[]
    slug: string
  },
) {
  return resolveAiSynthesisPathBlock(fs, input)
}

export async function createAiSynthesisNoteOrch(
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
) {
  return createAiSynthesisNoteBlock(fs, input)
}

export async function getImpactedAiSynthesisNotesOrch(
  fs: VaultFS,
  input: {
    changed_paths: string[]
  },
) {
  return getImpactedAiSynthesisNotesBlock(fs, input)
}

export async function updateAiSynthesisCompileStateOrch(
  fs: VaultFS,
  input: {
    path: string
    last_compiled_at?: string
    compile_status: string
  },
) {
  return updateAiSynthesisCompileStateBlock(fs, input)
}

export async function listDomainAiSynthesisHealthOrch(
  fs: VaultFS,
  input: {
    domain_root: string
  },
) {
  return listDomainAiSynthesisHealthBlock(fs, input)
}
