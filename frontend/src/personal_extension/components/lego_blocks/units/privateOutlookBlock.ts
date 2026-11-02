import { lazy, type ComponentType } from 'react'

// The Outlook tab lives in the same private folder as Real Estate
// (personal_extension/realestate), which is not part of the public repo.
// When the folder is present the tab is shown; when it is missing, this glob
// matches nothing and the tab is simply left out.
const OUTLOOK_MODULES = import.meta.glob<{ default: ComponentType }>('../../../realestate/outlook.tsx')
const loadOutlook = Object.values(OUTLOOK_MODULES)[0]

export const OUTLOOK_TAB_AVAILABLE = Boolean(loadOutlook)
export const PrivateOutlookBlock = loadOutlook ? lazy(loadOutlook) : null
