import { lazy, type ComponentType } from 'react'

// The Real Estate tab lives in a private folder (personal_extension/realestate)
// that is not part of the public repo. When the folder is present the tab is
// shown; when it is missing, this glob matches nothing and the tab is simply
// left out.
const REAL_ESTATE_MODULES = import.meta.glob<{ default: ComponentType }>('../../../realestate/index.tsx')
const loadRealEstate = Object.values(REAL_ESTATE_MODULES)[0]

export const REAL_ESTATE_TAB_AVAILABLE = Boolean(loadRealEstate)
export const PrivateRealEstateBlock = loadRealEstate ? lazy(loadRealEstate) : null
