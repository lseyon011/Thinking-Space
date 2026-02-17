// Shared types for the service layer.
// These mirror the Python backend response shapes.

// ── File Activity ──

export interface DayFile {
  path: string
  section: string
  size_bytes: number
  timestamp: string
}

export interface DayDetail {
  date: string
  created: DayFile[]
  modified: DayFile[]
  created_count: number
  modified_count: number
  sections: Record<string, { created: DayFile[]; modified: DayFile[] }>
}

export interface SectionDayEntry {
  date: string
  created: number
  modified: number
}

export interface SectionData {
  name: string
  created: number
  modified: number
}

export interface MonthData {
  year: number
  month: number
  days: Array<{ date: string; created: number; modified: number }>
  total_created: number
  total_modified: number
  sections: SectionData[]
  section_days: Record<string, SectionDayEntry[]>
}

export interface SectionMonthDay {
  date: string
  created: DayFile[]
  modified: DayFile[]
}

export interface SectionMonthData {
  section: string
  year: number
  month: number
  days: SectionMonthDay[]
  total_created: number
  total_modified: number
}

// ── Todos ──

export interface TodoMonthDay {
  date: string
  total: number
  done: number
  pending: number
}

export interface TodoSection {
  name: string
  total: number
  done: number
  pending: number
}

export interface TodoMonthData {
  year: number
  month: number
  days: TodoMonthDay[]
  total: number
  done: number
  pending: number
  sections: TodoSection[]
  section_days: Record<string, TodoMonthDay[]>
}

export interface TodoItem {
  text: string
  checked: boolean
  line: number
  file: string
  section: string
}

export interface TodoSectionMonthDay {
  date: string
  items: TodoItem[]
}

export interface TodoSectionMonthData {
  sections: string[]
  days: TodoSectionMonthDay[]
}

// ── Thoughts ──

export interface ThoughtMonthDay {
  date: string
  total: number
  done: number
  pending: number
}

export interface ThoughtSection {
  name: string
  total: number
  done: number
  pending: number
}

export interface ThoughtMonthData {
  year: number
  month: number
  days: ThoughtMonthDay[]
  total: number
  done: number
  pending: number
  sections: ThoughtSection[]
  section_days: Record<string, ThoughtMonthDay[]>
}

export interface ThoughtItem {
  text: string
  checked: boolean
  line: number
  file: string
  section: string
}

export interface ThoughtSectionMonthDay {
  date: string
  items: ThoughtItem[]
}

export interface ThoughtSectionMonthData {
  sections: string[]
  days: ThoughtSectionMonthDay[]
}

// ── Git Insights ──

export interface Pulse {
  days: number
  commits: number
  authors: number
  files_changed: number
  additions: number
  deletions: number
}

export interface Contributor {
  name: string
  commits: number
}

export interface WeeklyCommit {
  week_start: string
  count: number
}

export interface CodeFrequency {
  week_start: string
  additions: number
  deletions: number
}

export interface HeatmapDay {
  date: string
  count: number
}

export interface GitInsightsData {
  range_days: number
  summary: {
    total_commits: number
    unique_files: number
    additions: number
    deletions: number
    net_change: number
  }
  pulse: Pulse
  contributors: Contributor[]
  weekly_commits: WeeklyCommit[]
  code_frequency: CodeFrequency[]
  event_breakdown: {
    A: number
    M: number
    D: number
    R: number
  }
  top_files: Array<{
    file: string
    edits: number
    additions: number
    deletions: number
  }>
  time_distribution: {
    by_day: number[]
    by_hour: number[]
    most_active_day: number
    most_active_hour: number
    time_buckets: {
      night: number[]
      morning: number[]
      afternoon: number[]
      evening: number[]
    }
  }
  heatmap: {
    start_date: string
    end_date: string
    daily: HeatmapDay[]
  }
}

// ── File Stats ──

export interface FileStat {
  path: string
  lines: number
  words: number
  size_bytes: number
}

// ── Transcript Cleaner ──

export interface TranscriptOptions {
  heading_level: number
}

export interface CleanResult {
  success: boolean
  output_path: string | null
  preview: string
  message: string
}

// ── Format for Excalidraw ──

export interface FormatOptions {
  normalize_book: boolean
  strip_fences: boolean
  split_long_paragraphs: boolean
  join_lines: boolean
}

export interface FormatPreviewData {
  original: string
  formatted: string
  original_lines: number
  formatted_lines: number
}

export interface FormatResult {
  success: boolean
  output_path: string
  message: string
}

// ── Excalidraw Plugin ──

export interface ExcalidrawPluginStatus {
  plugin_id: string
  source_repo: string
  plugin_dir: string
  installed: boolean
  enabled: boolean
  installed_version: string | null
  latest_version: string | null
  release_url: string | null
  release_published_at: string | null
  update_available: boolean
  status_error: string | null
}

// ── Hierarchy DB ──

export interface HierarchyDbStatus {
  db_path: string
  exists: boolean
  initialized: boolean
  schema_version: number
  applied_migrations: string[]
  last_migration_id: string | null
}

export type HierarchyNodeType = 'project' | 'epic' | 'idea'

export interface HierarchyNode {
  id: string
  type: HierarchyNodeType
  node_kind: string
  title: string
  slug: string
  parent_id: string | null
  file_path: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HierarchyThought {
  id: string
  title: string | null
  slug: string
  file_path: string
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  link_count: number
}

export interface HierarchyThoughtLink {
  id: string
  thought_id: string
  node_id: string
  link_kind: string
  created_at: string
}

export interface HierarchyEdge {
  id: string
  from_node_id: string
  to_node_id: string
  edge_kind: string
  created_at: string
}

export interface HierarchyPathResolution {
  requested_path: string
  found: boolean
  resolved_path: string | null
  target_type: 'node' | 'thought' | null
  target_id: string | null
  via_alias: boolean
}

// ── PDF to Markdown ──

export interface ConvertOptions {
  preserve_layout: boolean
  page_breaks: boolean
}

export interface PdfPreviewData {
  preview: string
  page_count: number
  total_chars: number
}

export interface PdfConvertResult {
  success: boolean
  output_path: string
  page_count: number
  message: string
}
