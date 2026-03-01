import { useCallback, useEffect, useState } from 'react'
import {
  readCachedUserProfileBlock,
  type UserProfileBlock,
  type UserProfilePatchBlock,
} from '@/services/lego_blocks/units/userProfileBlock'
import {
  readUserProfileOrch,
  updateUserProfileOrch,
} from '@/services/orchestrators/userProfileOrch'

export function useUserProfileBlock() {
  const [profile, setProfile] = useState<UserProfileBlock>(() => readCachedUserProfileBlock())
  const [loading, setLoading] = useState(true)

  const reloadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const next = await readUserProfileOrch()
      setProfile(next)
      return next
    } finally {
      setLoading(false)
    }
  }, [])

  const saveProfile = useCallback(async (patch: UserProfilePatchBlock) => {
    const next = await updateUserProfileOrch(patch)
    setProfile(next)
    return next
  }, [])

  useEffect(() => {
    void reloadProfile()
  }, [reloadProfile])

  return {
    profile,
    loading,
    reloadProfile,
    saveProfile,
  }
}
