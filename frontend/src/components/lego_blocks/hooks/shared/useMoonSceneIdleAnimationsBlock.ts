/**
 * useMoonSceneIdleAnimationsBlock — ambient variety for the moon scene: while
 * a sprite has no scheduled message, it occasionally plays a random animation
 * from the library (skate, wizard, float, ...) for a short burst, then returns
 * to its idle loop. Each speaker runs an independent randomized timer chain so
 * the two never sync up. Disabled via the moonSceneIdleAnimationsEnabled pref.
 *
 * Also exposes playBurst() so clicking the scene triggers an immediate random
 * burst for both sprites — manual bursts work even when ambient ones are
 * disabled, since a click is explicit user intent.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MOON_SCENE_MESSAGES_UPDATED_EVENT_BLOCK,
  type MoonSceneAnimationBlock,
  type MoonSceneSpeakerBlock,
} from '@/services/lego_blocks/units/vaultUiPreferencesBlock'
import { readVaultUiPreferencesOrch } from '@/services/orchestrators/vaultUiPreferencesOrch'

const IDLE_ANIMATION_POOL: MoonSceneAnimationBlock[] = [
  'wave', 'dance', 'hop', 'cheer', 'spin', 'skate', 'wizard', 'run', 'float', 'sleep', 'hang', 'wag',
]

const IDLE_GAP_MIN_MS = 8 * 60_000
const IDLE_GAP_MAX_MS = 14 * 60_000
const PLAY_MIN_MS = 12_000
const PLAY_MAX_MS = 18_000
const CLICK_PLAY_MS = 7_000

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randomIdleAnimation(previous: MoonSceneAnimationBlock): MoonSceneAnimationBlock {
  const pool = IDLE_ANIMATION_POOL.filter(a => a !== previous)
  return pool[Math.floor(Math.random() * pool.length)]
}

export type IdleMoonSceneAnimationsBlock = Record<MoonSceneSpeakerBlock, MoonSceneAnimationBlock>

export interface MoonSceneIdleAnimationsResultBlock {
  animations: IdleMoonSceneAnimationsBlock
  playBurst: () => void
}

export function useMoonSceneIdleAnimationsBlock(): MoonSceneIdleAnimationsResultBlock {
  const [enabled, setEnabled] = useState(true)
  const [animations, setAnimations] = useState<IdleMoonSceneAnimationsBlock>({
    astronaut: 'none',
    clawd: 'none',
  })
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playBurst = useCallback(() => {
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    setAnimations(prev => ({
      astronaut: randomIdleAnimation(prev.astronaut),
      clawd: randomIdleAnimation(prev.clawd),
    }))
    burstTimerRef.current = setTimeout(() => {
      setAnimations({ astronaut: 'none', clawd: 'none' })
      burstTimerRef.current = null
    }, CLICK_PLAY_MS)
  }, [])

  useEffect(() => () => {
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void readVaultUiPreferencesOrch()
        .then(prefs => {
          if (!cancelled) setEnabled(prefs.moonSceneIdleAnimationsEnabled)
        })
        .catch(() => {
          /* keep current setting */
        })
    }
    load()
    window.addEventListener(MOON_SCENE_MESSAGES_UPDATED_EVENT_BLOCK, load)
    return () => {
      cancelled = true
      window.removeEventListener(MOON_SCENE_MESSAGES_UPDATED_EVENT_BLOCK, load)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setAnimations({ astronaut: 'none', clawd: 'none' })
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    let last: Record<MoonSceneSpeakerBlock, MoonSceneAnimationBlock> = {
      astronaut: 'none',
      clawd: 'none',
    }

    const scheduleBurst = (speaker: MoonSceneSpeakerBlock, gapMs: number) => {
      timers.push(setTimeout(() => {
        const next = randomIdleAnimation(last[speaker])
        last = { ...last, [speaker]: next }
        setAnimations(prev => ({ ...prev, [speaker]: next }))
        timers.push(setTimeout(() => {
          setAnimations(prev => ({ ...prev, [speaker]: 'none' }))
          scheduleBurst(speaker, randomBetween(IDLE_GAP_MIN_MS, IDLE_GAP_MAX_MS))
        }, randomBetween(PLAY_MIN_MS, PLAY_MAX_MS)))
      }, gapMs))
    }

    // Stagger the first bursts so the speakers start out of phase.
    scheduleBurst('astronaut', randomBetween(IDLE_GAP_MIN_MS, IDLE_GAP_MAX_MS))
    scheduleBurst('clawd', randomBetween(IDLE_GAP_MIN_MS / 2, IDLE_GAP_MAX_MS / 2))

    return () => {
      timers.forEach(clearTimeout)
      setAnimations({ astronaut: 'none', clawd: 'none' })
    }
  }, [enabled])

  return { animations, playBurst }
}
