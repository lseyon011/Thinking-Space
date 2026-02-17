import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

import { NodeVaultFS, runCapabilityRunnerCommand } from '../scripts/agent/capabilityRunner'
import { fullSync } from '@/services/orchestrators/vaultSyncOrch'

interface ParityFixture {
  id: string
  request: {
    capability: string
    input: Record<string, unknown>
    actor?: { kind: 'human' | 'agent' | 'system'; id?: string }
    requestId?: string
    dryRun?: boolean
  }
}

let capabilityOrch: typeof import('@/services/orchestrators/capabilityRouterOrch') | null = null

beforeEach(async () => {
  const fakeIdb = await import('fake-indexeddb')
  globalThis.indexedDB = fakeIdb.default
  globalThis.IDBKeyRange = fakeIdb.IDBKeyRange as any
  capabilityOrch = await import('@/services/orchestrators/capabilityRouterOrch')
})

afterEach(async () => {
  const { deleteDb } = await import('@/services/lego_blocks/dbBlock')
  await deleteDb()
})

describe('capability parity across frontend router and runner adapter', () => {
  it('keeps fixture responses equivalent', async () => {
    const fixtures = await loadFixtures()
    const fixtureVaultRoot = path.resolve(fileURLToPath(new URL('../../test-fixtures/vault', import.meta.url)))
    const { deleteDb } = await import('@/services/lego_blocks/dbBlock')

    for (const fixture of fixtures) {
      const routerVaultRoot = await cloneFixtureVault(fixtureVaultRoot)
      const runnerVaultRoot = await cloneFixtureVault(fixtureVaultRoot)
      try {
        const localFs = new NodeVaultFS(routerVaultRoot)
        await deleteDb()
        await fullSync(localFs)
        const routerResponse = await capabilityOrch!.invokeCapabilityOrch(fixture.request as any, { fs: localFs })

        await deleteDb()
        const runnerResponse = await runCapabilityRunnerCommand('invoke', {
          vaultRoot: runnerVaultRoot,
          request: fixture.request as any,
        }) as any

        expect(normalizeResponse(runnerResponse), fixture.id).toEqual(normalizeResponse(routerResponse))
      } finally {
        await fs.rm(routerVaultRoot, { recursive: true, force: true })
        await fs.rm(runnerVaultRoot, { recursive: true, force: true })
      }
    }
  })
})

async function loadFixtures(): Promise<ParityFixture[]> {
  const fixturePath = path.resolve(
    fileURLToPath(new URL('../../tests/fixtures/capability_parity_fixtures.json', import.meta.url)),
  )
  const raw = await fs.readFile(fixturePath, 'utf-8')
  return JSON.parse(raw) as ParityFixture[]
}

function normalizeResponse(value: unknown): unknown {
  return stripDynamicFields(value)
}

function stripDynamicFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => stripDynamicFields(item))
  if (!value || typeof value !== 'object') return value

  const record = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(record)) {
    if (key === 'requestId' || key === 'auditId') continue
    if (key === 'id') continue
    if (key === 'updatedAt' || key === 'updated_at') continue
    out[key] = stripDynamicFields(inner)
  }
  return out
}

async function cloneFixtureVault(sourceRoot: string): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ltm-cap-parity-'))
  await fs.cp(sourceRoot, tempRoot, { recursive: true })
  return tempRoot
}
