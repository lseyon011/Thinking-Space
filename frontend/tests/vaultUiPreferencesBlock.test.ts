import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK,
  createDefaultVaultUiPreferencesBlock,
  isMoonSceneMessageActiveBlock,
  normalizeMoonSceneMessagesPreferenceBlock,
  normalizeVaultUiPreferencesBlock,
  type MoonSceneMessagePreferenceBlock,
} from '@/services/lego_blocks/units/vaultUiPreferencesBlock'

describe('vaultUiPreferencesBlock', () => {
  it('uses the legacy folder color preset by default', () => {
    const defaults = createDefaultVaultUiPreferencesBlock()
    expect(defaults.explorerFolderColorRules).toEqual(DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK)
  })

  it('applies default preset when explorer folder color rules are missing in stored data', () => {
    const normalized = normalizeVaultUiPreferencesBlock({
      explorerIconStyle: 'filled',
      newThoughtQuickDestinations: [],
    })
    expect(normalized.explorerFolderColorRules).toEqual(DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK)
  })

  it('keeps explicit empty explorer folder color rules when user clears them', () => {
    const normalized = normalizeVaultUiPreferencesBlock({
      explorerFolderColorRules: [],
    })
    expect(normalized.explorerFolderColorRules).toEqual([])
  })

  it('defaults moonSceneMessages to empty when missing in stored data', () => {
    const normalized = normalizeVaultUiPreferencesBlock({})
    expect(normalized.moonSceneMessages).toEqual([])
  })

  it('defaults moonSceneIdleAnimationsEnabled to true and respects explicit false', () => {
    expect(normalizeVaultUiPreferencesBlock({}).moonSceneIdleAnimationsEnabled).toBe(true)
    expect(
      normalizeVaultUiPreferencesBlock({ moonSceneIdleAnimationsEnabled: false }).moonSceneIdleAnimationsEnabled,
    ).toBe(false)
  })
})

describe('normalizeMoonSceneMessagesPreferenceBlock', () => {
  it('drops entries with empty text or invalid times and defaults the rest', () => {
    const normalized = normalizeMoonSceneMessagesPreferenceBlock([
      { id: 'a', speaker: 'clawd', text: 'hello', startTime: '09:00', endTime: '10:30', animation: 'wave', enabled: true },
      { id: 'b', speaker: 'astronaut', text: '   ', startTime: '09:00', endTime: '10:00', animation: 'none', enabled: true },
      { id: 'c', speaker: 'astronaut', text: 'bad time', startTime: '9am', endTime: '10:00', animation: 'none', enabled: true },
      { id: 'd', speaker: 'robot', text: 'who am i', startTime: '11:00', endTime: '12:00', animation: 'moonwalk', enabled: 'yes' },
    ])
    expect(normalized).toHaveLength(2)
    expect(normalized[0]).toEqual({
      id: 'a', speaker: 'clawd', text: 'hello', startTime: '09:00', endTime: '10:30', animation: 'wave', enabled: true,
    })
    expect(normalized[1]).toMatchObject({ id: 'd', speaker: 'astronaut', animation: 'none', enabled: true })
  })

  it('deduplicates by id', () => {
    const entry = { speaker: 'clawd', text: 'x', startTime: '09:00', endTime: '10:00', animation: 'none', enabled: true }
    const normalized = normalizeMoonSceneMessagesPreferenceBlock([
      { ...entry, id: 'dup' },
      { ...entry, id: 'dup' },
    ])
    expect(normalized).toHaveLength(1)
  })
})

describe('isMoonSceneMessageActiveBlock', () => {
  const base: MoonSceneMessagePreferenceBlock = {
    id: 'm',
    speaker: 'clawd',
    text: 'hi',
    startTime: '09:00',
    endTime: '17:00',
    animation: 'none',
    enabled: true,
  }
  const at = (h: number, m: number) => new Date(2026, 5, 12, h, m)

  it('matches inside a same-day window, start inclusive, end exclusive', () => {
    expect(isMoonSceneMessageActiveBlock(base, at(9, 0))).toBe(true)
    expect(isMoonSceneMessageActiveBlock(base, at(12, 30))).toBe(true)
    expect(isMoonSceneMessageActiveBlock(base, at(17, 0))).toBe(false)
    expect(isMoonSceneMessageActiveBlock(base, at(8, 59))).toBe(false)
  })

  it('handles windows that wrap midnight', () => {
    const night = { ...base, startTime: '22:00', endTime: '06:00' }
    expect(isMoonSceneMessageActiveBlock(night, at(23, 15))).toBe(true)
    expect(isMoonSceneMessageActiveBlock(night, at(2, 0))).toBe(true)
    expect(isMoonSceneMessageActiveBlock(night, at(12, 0))).toBe(false)
  })

  it('is inactive when disabled or zero-length', () => {
    expect(isMoonSceneMessageActiveBlock({ ...base, enabled: false }, at(12, 0))).toBe(false)
    expect(isMoonSceneMessageActiveBlock({ ...base, startTime: '12:00', endTime: '12:00' }, at(12, 0))).toBe(false)
  })
})
