import { memo, useRef, type ReactNode } from 'react'

/**
 * Wraps a persistent-mounted route surface and freezes its React subtree
 * when inactive. The last rendered output is preserved in the DOM (hidden
 * via CSS by the parent), but React reconciliation is skipped entirely
 * because the memoized inner component receives a stable `children` ref
 * when `active` is false.
 *
 * This prevents hidden routes (e.g. ThinkingSpace while viewing Chat)
 * from re-rendering when App.tsx state changes.
 */
export function FrozenRouteBlock({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  const frozenRef = useRef<ReactNode>(children)

  // Always capture the latest children when active so the frozen snapshot
  // stays up-to-date. When inactive, keep returning the stale snapshot —
  // the memoized inner component sees no prop change and skips render.
  if (active) {
    frozenRef.current = children
  }

  return <FrozenInner>{frozenRef.current}</FrozenInner>
}

const FrozenInner = memo(function FrozenInner({ children }: { children: ReactNode }) {
  return <>{children}</>
})
