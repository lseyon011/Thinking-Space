export function utf8ToBytesBlock(input: string): Uint8Array {
  return new TextEncoder().encode(input)
}

export function bytesToUtf8Block(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

export function bytesToBase64Block(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
  }
  const maybeBuffer = (globalThis as { Buffer?: { from(input: Uint8Array): { toString(encoding: string): string } } }).Buffer
  if (maybeBuffer) return maybeBuffer.from(bytes).toString('base64')
  throw new Error('Base64 encoding is unavailable in this runtime')
}

export function base64ToBytesBlock(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  const maybeBuffer = (globalThis as { Buffer?: { from(input: string, encoding: string): { length: number; [index: number]: number } } }).Buffer
  if (maybeBuffer) {
    const buf = maybeBuffer.from(base64, 'base64')
    const out = new Uint8Array(buf.length)
    for (let i = 0; i < buf.length; i++) out[i] = buf[i]
    return out
  }
  throw new Error('Base64 decoding is unavailable in this runtime')
}

