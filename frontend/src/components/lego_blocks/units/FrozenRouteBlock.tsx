import { memo, useRef, type ReactNode } from 'react'

/**
 * Wraps a persistent-mounted route surface and freezes its React subtree
 * when inactive. The last rendered output is preserved in the DOM (hidden
 * via CSS by the parent), but React reconciliation is skipped after the
 * first inactive render so child cleanup hooks can still observe the
 * active -> inactive transition.
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
  const lastActiveRef = useRef(active)

  // Let children observe active/inactive transitions exactly once so route
  // cleanup hooks can run, then freeze subsequent inactive renders.
  if (active || lastActiveRef.current !== active) {
    frozenRef.current = children
    lastActiveRef.current = active
  }

  return <FrozenInner>{frozenRef.current}</FrozenInner>
}

const FrozenInner = memo(function FrozenInner({ children }: { children: ReactNode }) {
  return <>{children}</>
})
