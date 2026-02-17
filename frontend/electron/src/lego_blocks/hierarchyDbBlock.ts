import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'

import { HIERARCHY_MIGRATIONS_BLOCK } from './hierarchySchemaBlock'

const MIGRATIONS_TABLE_BLOCK = 'schema_migrations'

export interface HierarchyDbStatusBlock {
  db_path: string
  exists: boolean
  initialized: boolean
  schema_version: number
  applied_migrations: string[]
  last_migration_id: string | null
}

function assertInsideVaultBlock(vaultRoot: string, targetRelativePath: string): string {
  const rootResolved = path.resolve(vaultRoot)
  const resolved = path.resolve(vaultRoot, targetRelativePath)
  const relative = path.relative(rootResolved, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path traversal detected for hierarchy db')
  }
  return resolved
}

export function resolveHierarchyDbPathBlock(vaultRoot: string): string {
  return assertInsideVaultBlock(vaultRoot, path.join('.ltm-pilot', 'ltm.db'))
}

export function runSqliteExecBlock(dbPath: string, sql: string): void {
  const proc = spawnSync('sqlite3', [dbPath, sql], { encoding: 'utf-8' })
  if (proc.error) throw proc.error
  if (proc.status !== 0) {
    throw new Error(proc.stderr.trim() || proc.stdout.trim() || 'sqlite3 execution failed')
  }
}

export function runSqliteJsonQueryBlock<T>(dbPath: string, sql: string): T[] {
  const proc = spawnSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf-8' })
  if (proc.error) throw proc.error
  if (proc.status !== 0) {
    throw new Error(proc.stderr.trim() || proc.stdout.trim() || 'sqlite3 query failed')
  }
  const out = proc.stdout.trim()
  if (!out) return []
  return JSON.parse(out) as T[]
}

function ensureMigrationsTableBlock(dbPath: string): void {
  runSqliteExecBlock(dbPath, `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_BLOCK} (
  migration_id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`.trim())
}

function migrationTableExistsBlock(dbPath: string): boolean {
  const rows = runSqliteJsonQueryBlock<{ present: number }>(
    dbPath,
    `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = '${MIGRATIONS_TABLE_BLOCK}' LIMIT 1;`,
  )
  return rows.length > 0
}

function readAppliedMigrationsBlock(dbPath: string): string[] {
  const rows = runSqliteJsonQueryBlock<{ migration_id: string }>(
    dbPath,
    `SELECT migration_id FROM ${MIGRATIONS_TABLE_BLOCK} ORDER BY migration_id;`,
  )
  return rows.map((row) => row.migration_id)
}

function applyMigrationsBlock(dbPath: string): string[] {
  ensureMigrationsTableBlock(dbPath)
  const applied = new Set(readAppliedMigrationsBlock(dbPath))
  for (const migration of HIERARCHY_MIGRATIONS_BLOCK) {
    if (applied.has(migration.migrationId)) continue
    const safeMigrationId = migration.migrationId.replace(/'/g, "''")
    runSqliteExecBlock(dbPath, `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
BEGIN;
${migration.sql}
INSERT INTO ${MIGRATIONS_TABLE_BLOCK} (migration_id) VALUES ('${safeMigrationId}');
COMMIT;
`.trim())
  }
  return readAppliedMigrationsBlock(dbPath)
}

const CONTENT_PREFIX_BLOCK = '.ltm-pilot/thinking_organizer'

function migrateFilesToThinkingOrganizerBlock(vaultRoot: string, dbPath: string): void {
  const rows = runSqliteJsonQueryBlock<{ file_path: string }>(
    dbPath,
    `SELECT file_path FROM nodes;`,
  )
  for (const row of rows) {
    const newRelPath = row.file_path
    if (!newRelPath.startsWith(CONTENT_PREFIX_BLOCK + '/')) continue
    const oldRelPath = newRelPath.slice(CONTENT_PREFIX_BLOCK.length + 1)
    const oldAbsPath = path.join(vaultRoot, oldRelPath)
    const newAbsPath = path.join(vaultRoot, newRelPath)
    if (fs.existsSync(oldAbsPath) && !fs.existsSync(newAbsPath)) {
      fs.mkdirSync(path.dirname(newAbsPath), { recursive: true })
      fs.renameSync(oldAbsPath, newAbsPath)
    }
  }
}

export function initHierarchyDbBlock(vaultRoot: string): HierarchyDbStatusBlock {
  const dbPath = resolveHierarchyDbPathBlock(vaultRoot)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const appliedBefore = new Set(
    migrationTableExistsBlock(dbPath) ? readAppliedMigrationsBlock(dbPath) : [],
  )
  const applied = applyMigrationsBlock(dbPath)

  if (!appliedBefore.has('0002_move_content_to_thinking_organizer') && applied.includes('0002_move_content_to_thinking_organizer')) {
    migrateFilesToThinkingOrganizerBlock(vaultRoot, dbPath)
  }

  return {
    db_path: dbPath,
    exists: fs.existsSync(dbPath),
    initialized: applied.length > 0,
    schema_version: applied.length,
    applied_migrations: applied,
    last_migration_id: applied.length > 0 ? applied[applied.length - 1] : null,
  }
}

export function ensureHierarchyDbInitializedBlock(vaultRoot: string): string {
  const status = initHierarchyDbBlock(vaultRoot)
  return status.db_path
}

export function getHierarchyDbStatusBlock(vaultRoot: string): HierarchyDbStatusBlock {
  const dbPath = resolveHierarchyDbPathBlock(vaultRoot)
  if (!fs.existsSync(dbPath)) {
    return {
      db_path: dbPath,
      exists: false,
      initialized: false,
      schema_version: 0,
      applied_migrations: [],
      last_migration_id: null,
    }
  }
  if (!migrationTableExistsBlock(dbPath)) {
    return {
      db_path: dbPath,
      exists: true,
      initialized: false,
      schema_version: 0,
      applied_migrations: [],
      last_migration_id: null,
    }
  }

  const applied = readAppliedMigrationsBlock(dbPath)
  return {
    db_path: dbPath,
    exists: true,
    initialized: applied.length > 0,
    schema_version: applied.length,
    applied_migrations: applied,
    last_migration_id: applied.length > 0 ? applied[applied.length - 1] : null,
  }
}
