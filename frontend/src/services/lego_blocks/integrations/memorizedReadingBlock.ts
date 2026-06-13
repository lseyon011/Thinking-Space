// Renderer-side access to memorization activity.
//
// Memorization sessions are stored as `memorized_sessions` YAML frontmatter on
// individual notes and indexed into IndexedDB by the vault sync. So unlike
// GoodNotes there's nothing to harvest — we read the indexed nodes that carry
// that key and map each recorded sitting to a ParsedSession tagged
// source:'memorized'. Works on every platform (Electron / iPhone / web) because
// it's driven entirely by the local node index.

import type { ParsedSession } from '@/services/lego_blocks/units/aiActivityParserBlock'
import { getNodesByMetadataKey } from '@/services/lego_blocks/integrations/dbBlock'
import {
  parseMemorizedNotes,
  type MemorizedNote,
} from '@/services/lego_blocks/units/memorizedSessionParserBlock'

/**
 * Load memorization sessions from the node index. Returns [] when nothing has
 * been memorized yet (or the index isn't ready), so the "Memorize" sub-source
 * simply contributes nothing.
 */
export async function loadMemorizedSessions(): Promise<ParsedSession[]> {
  try {
    const nodes = await getNodesByMetadataKey('memorized_sessions')
    const notes: MemorizedNote[] = nodes.map(n => ({
      title: n.title,
      filePath: n.filePath,
      rawSessions: n.metadata?.memorized_sessions,
    }))
    return parseMemorizedNotes(notes)
  } catch {
    return []
  }
}
