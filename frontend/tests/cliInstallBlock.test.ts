import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronState = {
  isPackaged: true,
  tempPath: os.tmpdir(),
  userDataPath: os.tmpdir(),
  version: '2.5.0',
}

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return electronState.isPackaged
    },
    getPath(name: string) {
      if (name === 'temp') return electronState.tempPath
      if (name === 'userData') return electronState.userDataPath
      throw new Error(`Unexpected app.getPath(${name})`)
    },
    getVersion() {
      return electronState.version
    },
  },
}))

async function loadCliInstallBlock() {
  return import('../electron/src/lego_blocks/cliInstallBlock')
}

describe('cliInstallBlock', () => {
  let tempRoot = ''

  beforeEach(async () => {
    vi.resetModules()
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'thinkspc-cli-install-'))
    electronState.tempPath = path.join(tempRoot, 'temp')
    electronState.userDataPath = path.join(tempRoot, 'user-data')
    electronState.version = '2.5.0'
    electronState.isPackaged = true
    await fs.mkdir(electronState.tempPath, { recursive: true })
    await fs.mkdir(electronState.userDataPath, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('resolves default install targets for supported platforms', async () => {
    const { getCliTargetPathBlock } = await loadCliInstallBlock()

    expect(getCliTargetPathBlock({ platform: 'darwin' })).toBe('/usr/local/bin/thinkspc')
    expect(getCliTargetPathBlock({ platform: 'linux', homePath: '/home/tester' })).toBe('/home/tester/.local/bin/thinkspc')
    expect(
      getCliTargetPathBlock({
        platform: 'win32',
        localAppData: 'C:\\Users\\tester\\AppData\\Local',
      }),
    ).toBe('C:\\Users\\tester\\AppData\\Local/thinkspc/thinkspc.cmd')
  })

  it('injects the bundled resources path into the installed wrapper', async () => {
    const { buildInstalledCliWrapperBlock } = await loadCliInstallBlock()
    const wrapper = buildInstalledCliWrapperBlock(
      '#!/usr/bin/env bash\nset -euo pipefail\necho hi\n',
      '/Applications/Thinking Space.app/Contents/Resources',
    )

    expect(wrapper).toContain('#!/usr/bin/env bash\nTHINKSPC_APP_RESOURCES=')
    expect(wrapper).toContain('export THINKSPC_APP_RESOURCES')
    expect(wrapper).toContain("'/Applications/Thinking Space.app/Contents/Resources'")
    expect(wrapper).toContain('set -euo pipefail')
  })

  it('skips auto-install when launched from a mounted dmg path', async () => {
    const cliDir = path.join(tempRoot, 'resources', 'cli')
    await fs.mkdir(cliDir, { recursive: true })
    const sourcePath = path.join(cliDir, 'thinkspc-standalone.sh')
    await fs.writeFile(sourcePath, '#!/usr/bin/env bash\necho mounted\n', 'utf-8')

    const { ensureCliToolInstalledBlock } = await loadCliInstallBlock()
    const result = await ensureCliToolInstalledBlock({
      appVersion: '2.5.0',
      isPackaged: true,
      platform: 'darwin',
      resourcesPath: '/Volumes/Thinking Space/Thinking Space.app/Contents/Resources',
      sourcePath,
      targetPath: path.join(tempRoot, 'bin', 'thinkspc'),
      userDataPath: electronState.userDataPath,
    })

    expect(result).toEqual({
      status: 'skipped',
      targetPath: path.join(tempRoot, 'bin', 'thinkspc'),
      reason: 'mounted_dmg',
    })
  })

  it('installs a copied wrapper on first packaged launch and records state', async () => {
    const resourcesPath = '/Applications/Thinking Space.app/Contents/Resources'
    const cliDir = path.join(tempRoot, 'resources', 'cli')
    await fs.mkdir(cliDir, { recursive: true })
    const sourcePath = path.join(cliDir, 'thinkspc-standalone.sh')
    await fs.writeFile(sourcePath, '#!/usr/bin/env bash\nset -euo pipefail\necho ready\n', 'utf-8')
    const targetPath = path.join(tempRoot, 'bin', 'thinkspc')

    const {
      ensureCliToolInstalledBlock,
      getCliInstallStatePathBlock,
      readCliInstallStateBlock,
    } = await loadCliInstallBlock()
    const firstResult = await ensureCliToolInstalledBlock({
      appVersion: '2.5.0',
      isPackaged: true,
      platform: 'darwin',
      resourcesPath,
      sourcePath,
      targetPath,
      userDataPath: electronState.userDataPath,
    })

    expect(firstResult.status).toBe('installed')
    expect(firstResult.installMode).toBe('copied')

    const installedStat = await fs.lstat(targetPath)
    expect(installedStat.isFile()).toBe(true)

    const installedContent = await fs.readFile(targetPath, 'utf-8')
    expect(installedContent).toContain("THINKSPC_APP_RESOURCES='/Applications/Thinking Space.app/Contents/Resources'")
    expect(installedContent).toContain('export THINKSPC_APP_RESOURCES')
    expect(installedContent).toContain('echo ready')

    const statePath = getCliInstallStatePathBlock(electronState.userDataPath)
    await expect(fs.stat(statePath)).resolves.toBeTruthy()
    expect(readCliInstallStateBlock(electronState.userDataPath)).toMatchObject({
      installedVersion: '2.5.0',
      installedPath: targetPath,
      installMode: 'copied',
    })

    const secondResult = await ensureCliToolInstalledBlock({
      appVersion: '2.5.0',
      isPackaged: true,
      platform: 'darwin',
      resourcesPath,
      sourcePath,
      targetPath,
      userDataPath: electronState.userDataPath,
    })
    expect(secondResult.status).toBe('already_current')
  })

  it('throttles only recent repeat auto-install attempts from the same install path', async () => {
    const resourcesPath = '/Applications/Thinking Space.app/Contents/Resources'
    const cliDir = path.join(tempRoot, 'resources', 'cli')
    await fs.mkdir(cliDir, { recursive: true })
    const sourcePath = path.join(cliDir, 'thinkspc-standalone.sh')
    await fs.writeFile(sourcePath, '#!/usr/bin/env bash\necho retry\n', 'utf-8')
    const targetPath = path.join(tempRoot, 'bin', 'thinkspc')

    const {
      ensureCliToolInstalledBlock,
      writeCliInstallStateBlock,
    } = await loadCliInstallBlock()

    writeCliInstallStateBlock({
      lastFailureResourcesPath: resourcesPath,
      lastFailureCode: 'USER_CANCELLED',
      lastFailureMessage: 'User cancelled.',
      lastFailureAt: new Date().toISOString(),
    }, electronState.userDataPath)

    const result = await ensureCliToolInstalledBlock({
      appVersion: '2.5.0',
      isPackaged: true,
      platform: 'darwin',
      resourcesPath,
      sourcePath,
      targetPath,
      userDataPath: electronState.userDataPath,
    })

    expect(result).toEqual({
      status: 'skipped',
      targetPath,
      reason: 'recent_failure_same_install',
    })
    await expect(fs.stat(targetPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retries install for the same app version after an older failure record', async () => {
    const resourcesPath = '/Applications/Thinking Space.app/Contents/Resources'
    const cliDir = path.join(tempRoot, 'resources', 'cli')
    await fs.mkdir(cliDir, { recursive: true })
    const sourcePath = path.join(cliDir, 'thinkspc-standalone.sh')
    await fs.writeFile(sourcePath, '#!/usr/bin/env bash\necho retry-success\n', 'utf-8')
    const targetPath = path.join(tempRoot, 'bin', 'thinkspc')

    const {
      ensureCliToolInstalledBlock,
      readCliInstallStateBlock,
      writeCliInstallStateBlock,
    } = await loadCliInstallBlock()

    writeCliInstallStateBlock({
      lastFailureResourcesPath: resourcesPath,
      lastFailureCode: 'USER_CANCELLED',
      lastFailureMessage: 'User cancelled.',
      lastFailureAt: '2026-04-02T00:00:00.000Z',
    }, electronState.userDataPath)

    const result = await ensureCliToolInstalledBlock({
      appVersion: '2.5.0',
      isPackaged: true,
      platform: 'darwin',
      resourcesPath,
      sourcePath,
      targetPath,
      userDataPath: electronState.userDataPath,
    })

    expect(result.status).toBe('installed')
    expect(await fs.readFile(targetPath, 'utf-8')).toContain('retry-success')
    const state = readCliInstallStateBlock(electronState.userDataPath)
    expect(state).toMatchObject({
      installedVersion: '2.5.0',
      installedPath: targetPath,
    })
    expect(state.lastFailureResourcesPath).toBeUndefined()
  })
})
