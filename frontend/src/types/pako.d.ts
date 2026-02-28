declare module 'pako' {
  export function deflateRaw(data: Uint8Array): Uint8Array
  export function inflateRaw(data: Uint8Array): Uint8Array

  const pako: {
    deflateRaw(data: Uint8Array): Uint8Array
    inflateRaw(data: Uint8Array): Uint8Array
  }

  export default pako
}

