const TIKZJAX_SCRIPT_URL = 'https://tikzjax.com/v1/tikzjax.js'
const TIKZJAX_FONT_CSS_URL = 'https://tikzjax.com/v1/fonts.css'

let loadPromise: Promise<void> | null = null

export function ensureTikzJaxLoadedBlock(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector(`link[data-tikzjax-fonts]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = TIKZJAX_FONT_CSS_URL
      link.setAttribute('data-tikzjax-fonts', 'true')
      document.head.appendChild(link)
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-tikzjax-loader]')
    if (existing && (existing as any).__tikzjaxLoaded) {
      resolve()
      return
    }

    const script = existing ?? document.createElement('script')
    if (!existing) {
      script.src = TIKZJAX_SCRIPT_URL
      script.async = true
      script.setAttribute('data-tikzjax-loader', 'true')
      document.head.appendChild(script)
    }
    script.addEventListener('load', () => {
      ;(script as any).__tikzjaxLoaded = true
      resolve()
    })
    script.addEventListener('error', () => {
      loadPromise = null
      reject(new Error('Failed to load TikZJax'))
    })
  })

  return loadPromise
}
