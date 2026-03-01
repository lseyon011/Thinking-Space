declare module 'd3-selection' {
  export function select(target: EventTarget | null): any
}

declare module 'd3-zoom' {
  export function zoom(): any
  export const zoomIdentity: {
    scale: (k: number) => any
  }
}
