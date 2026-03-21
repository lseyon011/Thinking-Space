import type { PasswordAutofillWebContextBlock } from '@/services/lego_blocks/units/passwordAutofillMatchBlock'

function parseContextBlock(raw: unknown): PasswordAutofillWebContextBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (
    typeof record.url !== 'string'
    || typeof record.origin !== 'string'
    || typeof record.hostname !== 'string'
    || typeof record.pageTitle !== 'string'
    || typeof record.usernameValue !== 'string'
    || typeof record.passwordValue !== 'string'
    || (record.activeField !== 'username' && record.activeField !== 'password' && record.activeField !== 'other')
  ) {
    return null
  }
  const rectRaw = record.rect
  const rect = rectRaw && typeof rectRaw === 'object'
    ? (() => {
      const rectRecord = rectRaw as Record<string, unknown>
      const keys = ['left', 'top', 'right', 'bottom', 'width', 'height'] as const
      if (keys.some((key) => typeof rectRecord[key] !== 'number' || !Number.isFinite(rectRecord[key] as number))) {
        return null
      }
      return {
        left: rectRecord.left as number,
        top: rectRecord.top as number,
        right: rectRecord.right as number,
        bottom: rectRecord.bottom as number,
        width: rectRecord.width as number,
        height: rectRecord.height as number,
      }
    })()
    : null

  return {
    url: record.url,
    origin: record.origin,
    hostname: record.hostname,
    pageTitle: record.pageTitle,
    usernameValue: record.usernameValue,
    passwordValue: record.passwordValue,
    activeField: record.activeField,
    rect,
  }
}

export function passwordAutofillProbeScriptBlock(): string {
  return `(() => {
    const isVisibleInput = (element) => {
      if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) return false
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return !element.disabled
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && rect.width > 0
        && rect.height > 0
    }

    const findLoginContext = () => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement)) return null

      const forms = []
      const candidates = Array.from(document.querySelectorAll('form'))
      for (const form of candidates) {
        if (!(form instanceof HTMLFormElement)) continue
        const passwordInputs = Array.from(form.querySelectorAll('input[type="password"]')).filter(isVisibleInput)
        if (passwordInputs.length === 0) continue
        forms.push({ form, passwordInput: passwordInputs[0] })
      }

      const activeForm = forms.find(({ form, passwordInput }) =>
        form.contains(active) || active === passwordInput
      )
      if (!activeForm) return null

      const usernameCandidates = Array.from(activeForm.form.querySelectorAll('input, textarea'))
        .filter(isVisibleInput)
        .filter((element) => {
          if (element === activeForm.passwordInput) return false
          if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) return false
          if (element instanceof HTMLInputElement) {
            const type = (element.type || 'text').toLowerCase()
            return ['text', 'email', 'search', 'tel', 'url'].includes(type)
              || element.autocomplete === 'username'
              || element.name.toLowerCase().includes('user')
              || element.name.toLowerCase().includes('email')
          }
          return true
        })
      const usernameInput = usernameCandidates[0] || null
      const anchor = active === activeForm.passwordInput || active === usernameInput ? active : activeForm.passwordInput
      if (!(anchor instanceof HTMLElement)) return null

      const rect = anchor.getBoundingClientRect()
      return {
        url: window.location.href,
        origin: window.location.origin,
        hostname: window.location.hostname,
        pageTitle: document.title || window.location.hostname,
        usernameValue: usernameInput instanceof HTMLInputElement || usernameInput instanceof HTMLTextAreaElement ? usernameInput.value || '' : '',
        passwordValue: activeForm.passwordInput instanceof HTMLInputElement ? activeForm.passwordInput.value || '' : '',
        activeField: active === activeForm.passwordInput ? 'password' : active === usernameInput ? 'username' : 'other',
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      }
    }

    return findLoginContext()
  })()`
}

export async function probePasswordAutofillContextBlock(
  webview: { executeJavaScript?: (script: string, userGesture?: boolean) => Promise<unknown> } | null,
): Promise<PasswordAutofillWebContextBlock | null> {
  if (!webview?.executeJavaScript) return null
  const raw = await webview.executeJavaScript(passwordAutofillProbeScriptBlock(), true)
  return parseContextBlock(raw)
}

export function buildPasswordAutofillFillScriptBlock(input: {
  username: string
  password: string
}): string {
  const username = JSON.stringify(input.username)
  const password = JSON.stringify(input.password)
  return `(() => {
    const dispatchValue = (element, value) => {
      if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) return
      const proto = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
      descriptor?.set?.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }

    const isVisibleInput = (element) => {
      if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) return false
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return !element.disabled
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && rect.width > 0
        && rect.height > 0
    }

    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return false
    const form = active.closest('form')
    if (!(form instanceof HTMLFormElement)) return false

    const passwordInput = Array.from(form.querySelectorAll('input[type="password"]')).find(isVisibleInput)
    if (!(passwordInput instanceof HTMLInputElement)) return false

    const usernameInput = Array.from(form.querySelectorAll('input, textarea'))
      .filter(isVisibleInput)
      .find((element) => {
        if (element === passwordInput) return false
        if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) return false
        if (element instanceof HTMLInputElement) {
          const type = (element.type || 'text').toLowerCase()
          return ['text', 'email', 'search', 'tel', 'url'].includes(type)
            || element.autocomplete === 'username'
            || element.name.toLowerCase().includes('user')
            || element.name.toLowerCase().includes('email')
        }
        return true
      }) || null

    if (usernameInput) dispatchValue(usernameInput, ${username})
    dispatchValue(passwordInput, ${password})
    passwordInput.focus()
    return true
  })()`
}
