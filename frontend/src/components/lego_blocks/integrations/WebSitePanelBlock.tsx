import { useMemo } from 'react'
import { Bookmark, Globe, PanelLeftClose } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildWebSiteGroupTreeBlock,
  type WebSiteBlock,
  type WebSiteGroupBlock,
  type WebSiteGroupTreeNodeBlock,
} from '@/services/lego_blocks/units/webSiteBlock'
import { useExpandedSetBlock } from '@/components/lego_blocks/hooks/shared/useExpandedSetBlock'
import SidebarGroupHeaderBlock from '@/components/lego_blocks/units/ui/SidebarGroupHeaderBlock'

interface WebSitePanelBlockProps {
  bookmarks: WebSiteBlock[]
  groups: WebSiteGroupBlock[]
  selectedSiteId: string | null
  onSelectSite: (site: WebSiteBlock) => void
  onClose: () => void
}

export default function WebSitePanelBlock({
  bookmarks,
  groups,
  selectedSiteId,
  onSelectSite,
  onClose,
}: WebSitePanelBlockProps) {
  const { isExpanded: isGroupExpanded, toggle: toggleGroup } = useExpandedSetBlock('ltm-web-expanded-groups')

  const tree = useMemo(
    () => buildWebSiteGroupTreeBlock(groups, bookmarks),
    [groups, bookmarks],
  )

  const hasGroups = groups.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="ltm-shell-segment-header flex h-11 shrink-0 items-center justify-between px-2">
        <span className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Web
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Site list */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {bookmarks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <Globe className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No sites yet.</p>
            <p className="text-[11px] text-muted-foreground/60">Add some in Settings → Web.</p>
          </div>
        )}

        {/* Flat list when no groups configured */}
        {!hasGroups && bookmarks.map(b => (
          <SiteRow
            key={b.id}
            site={b}
            isSelected={selectedSiteId === b.id}
            onSelect={onSelectSite}
            depth={0}
          />
        ))}

        {/* Tree rendering when groups exist */}
        {hasGroups && tree.map((node, i) => (
          <WebSiteTreeRenderer
            key={node.group?.id ?? `__root__${i}`}
            node={node}
            selectedSiteId={selectedSiteId}
            onSelectSite={onSelectSite}
            isGroupExpanded={isGroupExpanded}
            toggleGroup={toggleGroup}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}

function WebSiteTreeRenderer({
  node,
  selectedSiteId,
  onSelectSite,
  isGroupExpanded,
  toggleGroup,
  depth,
}: {
  node: WebSiteGroupTreeNodeBlock
  selectedSiteId: string | null
  onSelectSite: (site: WebSiteBlock) => void
  isGroupExpanded: (id: string) => boolean
  toggleGroup: (id: string) => void
  depth: number
}) {
  // Root node — render bookmarks + children without a group header
  if (!node.group) {
    return (
      <>
        {node.bookmarks.map(b => (
          <SiteRow key={b.id} site={b} isSelected={selectedSiteId === b.id} onSelect={onSelectSite} depth={depth} />
        ))}
        {node.children.map(child => (
          <WebSiteTreeRenderer
            key={child.group!.id}
            node={child}
            selectedSiteId={selectedSiteId}
            onSelectSite={onSelectSite}
            isGroupExpanded={isGroupExpanded}
            toggleGroup={toggleGroup}
            depth={depth}
          />
        ))}
      </>
    )
  }

  const expanded = isGroupExpanded(node.group.id)
  const totalCount = node.bookmarks.length + node.children.length

  return (
    <div>
      <SidebarGroupHeaderBlock
        name={node.group.name}
        expanded={expanded}
        onToggle={() => toggleGroup(node.group!.id)}
        badge={totalCount > 0 ? totalCount : undefined}
        depth={depth}
      />
      {expanded && (
        <>
          {node.bookmarks.map(b => (
            <SiteRow key={b.id} site={b} isSelected={selectedSiteId === b.id} onSelect={onSelectSite} depth={depth + 1} />
          ))}
          {node.children.map(child => (
            <WebSiteTreeRenderer
              key={child.group!.id}
              node={child}
              selectedSiteId={selectedSiteId}
              onSelectSite={onSelectSite}
              isGroupExpanded={isGroupExpanded}
              toggleGroup={toggleGroup}
              depth={depth + 1}
            />
          ))}
        </>
      )}
    </div>
  )
}

function SiteRow({
  site,
  isSelected,
  onSelect,
  depth,
}: {
  site: WebSiteBlock
  isSelected: boolean
  onSelect: (b: WebSiteBlock) => void
  depth: number
}) {
  const hostname = useMemo(() => {
    try { return new URL(site.url).hostname }
    catch { return site.url }
  }, [site.url])

  return (
    <button
      type="button"
      onClick={() => onSelect(site)}
      style={depth > 0 ? { paddingLeft: `${12 + depth * 12}px` } : undefined}
      className={cn(
        'flex w-full items-center gap-2 border-b border-border/40 px-3 py-2.5 text-left text-sm transition-colors',
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-accent',
      )}
    >
      <Bookmark className={cn(
        'h-3.5 w-3.5 shrink-0',
        isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground/50',
      )} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm leading-snug">{site.name}</div>
        <div className={cn(
          'truncate text-[11px] leading-snug',
          isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground',
        )}>
          {hostname}
        </div>
      </div>
    </button>
  )
}
