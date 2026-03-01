type PromiseWithResolversResultBlock<T> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

declare global {
  interface PromiseConstructor {
    withResolvers?<T>(): PromiseWithResolversResultBlock<T>
  }
}

const PromiseConstructorBlock = Promise as PromiseConstructor

if (typeof PromiseConstructorBlock.withResolvers !== 'function') {
  Object.defineProperty(PromiseConstructorBlock, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function withResolvers<T>(): PromiseWithResolversResultBlock<T> {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    },
  })
}

export {}
