# Orchestrator Template

Use this for new major page/feature orchestrator files.

Goal:
- Keep orchestrators predictable and easy to scan.
- Keep lego-block primitives reusable and uncluttered.

## Required Section Order
1. Imports
2. Local constants and types
3. Orchestrator component signature
4. State and data hooks
5. Derived data/selectors (`useMemo`)
6. Side effects (`useEffect`)
7. Action handlers (`useCallback` or functions)
8. Render helpers (optional)
9. Return JSX in clear layout blocks

## TypeScript Skeleton
```tsx
// 1) Imports
import { useCallback, useEffect, useMemo, useState } from 'react'
import FeatureBlock from '@/components/lego_blocks/FeatureBlock'
import { useFeatureData } from '@/services/feature'

// 2) Local constants and types
type ViewMode = 'list' | 'grid'
const DEFAULT_VIEW: ViewMode = 'list'

// 3) Orchestrator component
export default function FeatureOrch() {
  // 4) State and data hooks
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_VIEW)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data, loading, error, refetch } = useFeatureData()

  // 5) Derived data/selectors
  const visibleItems = useMemo(() => {
    if (!data) return []
    return data.items.filter(item => item.visible)
  }, [data])

  // 6) Side effects
  useEffect(() => {
    if (!selectedId && visibleItems.length > 0) {
      setSelectedId(visibleItems[0].id)
    }
  }, [selectedId, visibleItems])

  // 7) Action handlers
  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  // 8) Render helpers (optional)
  const renderEmpty = () => (
    <div className="text-sm text-muted-foreground">No items found.</div>
  )

  // 9) Return JSX
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Feature</h1>
        <button onClick={handleRefresh}>Refresh</button>
      </header>

      {error && <div className="text-sm text-destructive">{error.message}</div>}
      {loading && <div className="text-sm text-muted-foreground">Loading...</div>}

      {!loading && visibleItems.length === 0 && renderEmpty()}

      {!loading && visibleItems.length > 0 && (
        <FeatureBlock
          items={visibleItems}
          viewMode={viewMode}
          selectedId={selectedId}
          onViewModeChange={setViewMode}
          onSelect={handleSelect}
        />
      )}
    </section>
  )
}
```

## Review Checklist
- Is this file orchestrating, not re-implementing shared primitives?
- Is reusable logic extracted to shared hooks/services/components?
- Are sections in required order for fast agent scanning?
- Are handlers/effects localized and predictable?
- Is this file in `frontend/src/components/orchestrators/*` and named `*Orch.tsx`?
- Are all reusable presentational pieces imported from `frontend/src/components/lego_blocks/*`?
- Is this orchestrator still thin, with heavy/reusable logic extracted out?
