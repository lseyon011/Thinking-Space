const TIKZJAX_SCRIPT_URL = '/tikzjax/tikzjax.js'
const TIKZJAX_FONT_CSS_URL = 'https://tikzjax.com/v1/fonts.css'
const TIKZJAX_BOOTSTRAP_PREFIX = 'window.onload=async function(){'
const TIKZJAX_BOOTSTRAP_SUFFIX = 'var r=document.getElementsByTagName("script");Array.prototype.slice.call(r).filter(A=>"text/tikz"===A.getAttribute("type")).reduce(async(A,e)=>(await A,t(e)),Promise.resolve())}'

declare global {
  interface Window {
    __tikzjaxProcess?: () => Promise<void> | void
  }
}

function ensureFontsBlock(): void {
  if (document.querySelector('link[data-tikzjax-fonts]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = TIKZJAX_FONT_CSS_URL
  link.setAttribute('data-tikzjax-fonts', 'true')
  document.head.appendChild(link)
}

let patchedSourcePromise: Promise<string> | null = null
let runtimeReadyPromise: Promise<void> | null = null

function patchTikzJaxSourceBlock(source: string): string {
  if (!source.includes(TIKZJAX_BOOTSTRAP_PREFIX) || !source.includes(TIKZJAX_BOOTSTRAP_SUFFIX)) {
    throw new Error('Unexpected TikZJax bundle format')
  }

  return source
    .replace('t.parentNode.replaceChild(n,t)', 't.parentNode&&t.parentNode.replaceChild(n,t)')
    .replace(TIKZJAX_BOOTSTRAP_PREFIX, 'window.__tikzjaxProcess=async function(){')
    .replace(
      TIKZJAX_BOOTSTRAP_SUFFIX,
      `${TIKZJAX_BOOTSTRAP_SUFFIX},"complete"===document.readyState?void window.__tikzjaxProcess():window.addEventListener("load",()=>{void window.__tikzjaxProcess()},{once:!0})`,
    )
}

function readPatchedTikzJaxSourceBlock(): Promise<string> {
  if (!patchedSourcePromise) {
    patchedSourcePromise = fetch(TIKZJAX_SCRIPT_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch TikZJax source (${response.status})`)
        }
        return patchTikzJaxSourceBlock(await response.text())
      })
  }
  return patchedSourcePromise
}

function ensureTikzJaxRuntimeBlock(): Promise<void> {
  if (typeof window !== 'undefined' && typeof window.__tikzjaxProcess === 'function') {
    return Promise.resolve()
  }
  if (runtimeReadyPromise) return runtimeReadyPromise

  runtimeReadyPromise = readPatchedTikzJaxSourceBlock()
    .then((source) => {
      if (document.querySelector('script[data-tikzjax-loader]')) {
        return
      }

      const script = document.createElement('script')
      script.async = false
      script.setAttribute('data-tikzjax-loader', 'true')
      script.text = source
      document.head.appendChild(script)
    })
    .catch((error) => {
      runtimeReadyPromise = null
      throw error instanceof Error ? error : new Error(String(error))
    })

  return runtimeReadyPromise
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null
let pendingPromise: Promise<void> | null = null
let resolvePending: (() => void) | null = null

export function requestTikzJaxProcessBlock(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  ensureFontsBlock()

  if (!pendingPromise) {
    pendingPromise = new Promise<void>((resolve) => {
      resolvePending = resolve
    })
  }

  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    const resolver = resolvePending
    const promise = pendingPromise
    pendingPromise = null
    resolvePending = null
    ensureTikzJaxRuntimeBlock()
      .then(() => Promise.resolve(window.__tikzjaxProcess?.()))
      .then(() => resolver?.())
      .catch(() => resolver?.())
    void promise
  }, 50)

  return pendingPromise
}
