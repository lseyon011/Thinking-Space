export interface BuildF9WebullHeadersInputBlock {
  method: string
  url: string
  appKey: string
  appSecret: string
  body?: string
}

export interface BuildF9WebullHeadersResultBlock {
  headers: Record<string, string>
  timestamp: string
  nonce: string
  signature: string
}

function createNonceBlock(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `f9-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function formatTimestampUtcBlock(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function getCanonicalUriBlock(rawUrl: string): string {
  return new URL(rawUrl).pathname
}

function parseCanonicalQueryBlock(rawUrl: string): Array<[string, string]> {
  const url = new URL(rawUrl)
  const entries = Array.from(url.searchParams.entries())
  return entries
    .map(([key, value]) => [key.trim(), value.trim()] as [string, string])
    .filter(([key]) => key.length > 0)
}

function buildCanonicalSourceBlock(
  uri: string,
  queryEntries: Array<[string, string]>,
  headerEntries: Array<[string, string]>,
  bodyMd5UpperHex?: string,
): string {
  const merged = [...queryEntries, ...headerEntries]
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .sort((a, b) => {
      const keyCompare = a[0].localeCompare(b[0])
      if (keyCompare !== 0) return keyCompare
      return a[1].localeCompare(b[1])
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  if (bodyMd5UpperHex?.trim()) {
    return `${uri}&${merged}&${bodyMd5UpperHex.trim()}`
  }
  return `${uri}&${merged}`
}

function encodeSignatureSourceBlock(value: string): string {
  return encodeURIComponent(value)
}

function bytesToBase64Block(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function signHmacSha1Base64Block(secret: string, payload: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is unavailable in this runtime.')
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${secret}&`),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return bytesToBase64Block(new Uint8Array(signatureBuffer))
}

export async function buildF9WebullHeadersBlock(
  input: BuildF9WebullHeadersInputBlock,
): Promise<BuildF9WebullHeadersResultBlock> {
  const normalizedMethod = input.method.trim().toUpperCase()
  if (!normalizedMethod) {
    throw new Error('HTTP method is required for Webull signing.')
  }
  const url = new URL(input.url)
  const timestamp = formatTimestampUtcBlock()
  const nonce = createNonceBlock()
  const uri = getCanonicalUriBlock(input.url)
  const queryEntries = parseCanonicalQueryBlock(input.url)

  const headerEntries: Array<[string, string]> = [
    ['host', url.host],
    ['x-app-key', input.appKey],
    ['x-signature-algorithm', 'HMAC-SHA1'],
    ['x-signature-nonce', nonce],
    ['x-signature-version', '1.0'],
    ['x-timestamp', timestamp],
  ]
  const source = buildCanonicalSourceBlock(
    uri,
    queryEntries,
    headerEntries,
    undefined, // No request body for current F9 Overall GET flow.
  )
  const encoded = encodeSignatureSourceBlock(source)
  const signature = await signHmacSha1Base64Block(input.appSecret, encoded)

  return {
    timestamp,
    nonce,
    signature,
    headers: {
      host: url.host,
      'x-app-key': input.appKey,
      'x-signature-algorithm': 'HMAC-SHA1',
      'x-signature-version': '1.0',
      'x-timestamp': timestamp,
      'x-signature': signature,
      'x-signature-nonce': nonce,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'think-space-f9',
    },
  }
}
