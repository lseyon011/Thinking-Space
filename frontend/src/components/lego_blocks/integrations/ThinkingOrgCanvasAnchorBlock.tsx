import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, FolderTree, Layers, Lightbulb, ListChecks, Loader2 } from 'lucide-react'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import type { CapabilityActor } from '@/services/lego_blocks/integrations/capabilityRegistryBlock'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import type { NodeType } from '@/services/lego_blocks/units/yamlNoteBlock'
import { defaultNodeKindLabel } from '@/components/lego_blocks/integrations/HierarchyTreeBlock'

interface AnchorProps {
  centerX: number
  centerY: number
}

const PANEL_W = 920
const PANEL_H = 760
const MISSION_W = 720
const MISSION_H = 120
const MISSION_OFFSET_Y = -(PANEL_H / 2) - MISSION_H - 32
const CHILDREN_LIMIT = 12

// Stored as a sibling localStorage key (rather than embedding inside the canvas
// JSON) so the canvas storage schema stays generic across all CanvasSurfaceOrch
// callers. Keyed at module scope — there's only one Board surface.
export const THINKING_ORG_CANVAS_SELECTED_PROGRAM_KEY_STORAGE =
  'thinking-org-canvas-selected-program'

const ANCHOR_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.organizer-board-anchor',
}

function readSelectedProgramKey(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(THINKING_ORG_CANVAS_SELECTED_PROGRAM_KEY_STORAGE)
}

function writeSelectedProgramKey(value: string | null) {
  if (typeof window === 'undefined') return
  if (value) window.localStorage.setItem(THINKING_ORG_CANVAS_SELECTED_PROGRAM_KEY_STORAGE, value)
  else window.localStorage.removeItem(THINKING_ORG_CANVAS_SELECTED_PROGRAM_KEY_STORAGE)
}

function childIcon(type: NodeType) {
  if (type === 'epic') return Layers
  if (type === 'task') return ListChecks
  return Lightbulb
}

export default function ThinkingOrgCanvasAnchorBlock({ centerX, centerY }: AnchorProps) {
  const theme = useCanvasThemeBlock()
  const { openFile } = useMarkdownViewer()

  const [programs, setPrograms] = useState<NodeRecord[]>([])
  const [loadingPrograms, setLoadingPrograms] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(() => readSelectedProgramKey())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [children, setChildren] = useState<NodeRecord[]>([])
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingPrograms(true)
      setError(null)
      try {
        const { nodes } = await invokeCapabilityOrThrow({
          capability: 'organizer.nodes.list_roots',
          input: { typeFilter: 'program' },
          actor: ANCHOR_ACTOR,
        })
        if (cancelled) return
        const sorted = [...nodes].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
        setPrograms(sorted)
        if (!readSelectedProgramKey() && sorted.length > 0) {
          setSelectedKey(sorted[0].key)
          writeSelectedProgramKey(sorted[0].key)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load programs')
      } finally {
        if (!cancelled) setLoadingPrograms(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedProgram = useMemo(
    () => programs.find(p => p.key === selectedKey) ?? null,
    [programs, selectedKey],
  )

  useEffect(() => {
    if (!selectedProgram) {
      setChildren([])
      return
    }
    let cancelled = false
    setLoadingChildren(true)
    setError(null)
    ;(async () => {
      try {
        const { nodes } = await invokeCapabilityOrThrow({
          capability: 'organizer.nodes.list_children',
          input: { parentKey: selectedProgram.key },
          actor: ANCHOR_ACTOR,
        })
        if (cancelled) return
        const sorted = [...nodes].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
        setChildren(sorted.slice(0, CHILDREN_LIMIT))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load children')
      } finally {
        if (!cancelled) setLoadingChildren(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedProgram])

  const handlePickProgram = useCallback((key: string) => {
    setSelectedKey(key)
    writeSelectedProgramKey(key)
    setPickerOpen(false)
  }, [])

  const missionX = centerX - MISSION_W / 2
  const missionY = centerY + MISSION_OFFSET_Y
  const panelX = centerX - PANEL_W / 2
  const panelY = centerY - PANEL_H / 2

  return (
    <div className={theme.isDark ? 'dark' : ''}>
      <div
        data-canvas-anchor-element="true"
        onMouseDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: missionX,
          top: missionY,
          width: MISSION_W,
          height: MISSION_H,
          textAlign: 'center',
          userSelect: 'none',
          zIndex: 2,
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: theme.anchorEyebrow,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Board
        </p>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: theme.anchorHeading,
            margin: '8px 0 0',
          }}
        >
          Thinking space
        </h1>
        <p
          style={{
            fontSize: 14,
            color: theme.anchorEyebrow,
            margin: '6px 0 0',
          }}
        >
          A canvas anchored on a program. Drop post-its, notes, and widgets around it.
        </p>
      </div>

      <div
        data-canvas-anchor-element="true"
        onMouseDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: panelX,
          top: panelY,
          width: PANEL_W,
          height: PANEL_H,
          padding: 20,
          borderRadius: 14,
          background: theme.anchorPanelBg,
          border: `1px solid ${theme.anchorPanelBorder}`,
          boxShadow: theme.anchorPanelShadow,
          overflow: 'auto',
          cursor: 'default',
          zIndex: 2,
          color: theme.tileText,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: theme.tileTextMuted,
                margin: 0,
              }}
            >
              Program
            </p>
            <h2
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: theme.anchorHeading,
                margin: '4px 0 0',
                lineHeight: 1.2,
              }}
            >
              {loadingPrograms
                ? 'Loading...'
                : selectedProgram?.title ?? (programs.length === 0 ? 'No programs yet' : 'Pick a program')}
            </h2>
            {selectedProgram?.description && (
              <p
                style={{
                  fontSize: 13,
                  color: theme.tileTextMuted,
                  margin: '6px 0 0',
                  lineHeight: 1.5,
                }}
              >
                {selectedProgram.description}
              </p>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setPickerOpen(open => !open)}
              disabled={loadingPrograms || programs.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${theme.anchorPanelBorder}`,
                background: 'transparent',
                color: theme.tileText,
                fontSize: 13,
                cursor: loadingPrograms || programs.length === 0 ? 'default' : 'pointer',
                opacity: loadingPrograms || programs.length === 0 ? 0.5 : 1,
              }}
            >
              <FolderTree size={14} />
              <span>Pick program</span>
              <ChevronDown size={14} />
            </button>
            {pickerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: 260,
                  maxHeight: 320,
                  overflowY: 'auto',
                  borderRadius: 10,
                  border: `1px solid ${theme.anchorPanelBorder}`,
                  background: theme.anchorPanelBg,
                  boxShadow: theme.anchorPanelShadow,
                  padding: 6,
                  zIndex: 3,
                }}
              >
                {programs.map(program => {
                  const active = program.key === selectedKey
                  return (
                    <button
                      key={program.uuid}
                      type="button"
                      onClick={() => handlePickProgram(program.key)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: 'none',
                        textAlign: 'left',
                        background: active ? theme.anchorPanelBorder : 'transparent',
                        color: theme.tileText,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      <FolderTree size={14} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {program.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: theme.tileTextMuted,
            }}
          >
            Recent children
          </div>
          {loadingChildren ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: theme.tileTextMuted, fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" />
              Loading...
            </div>
          ) : children.length === 0 ? (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: `1px dashed ${theme.anchorPanelBorder}`,
                color: theme.tileTextMuted,
                fontSize: 13,
              }}
            >
              {selectedProgram ? 'No children yet under this program.' : 'Pick a program to see its children.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
                overflow: 'auto',
              }}
            >
              {children.map(child => {
                const Icon = childIcon(child.type)
                return (
                  <button
                    key={child.uuid}
                    type="button"
                    onClick={() => openFile(child.filePath)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${theme.anchorPanelBorder}`,
                      background: 'transparent',
                      color: theme.tileText,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon size={14} />
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        {child.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: theme.tileTextMuted }}>
                      {defaultNodeKindLabel(child.type)}
                      {child.status && child.status !== 'active' ? ` · ${child.status}` : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(220, 38, 38, 0.4)',
              background: 'rgba(220, 38, 38, 0.1)',
              color: 'rgb(220, 38, 38)',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
