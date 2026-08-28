import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => cleanup())

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverStub,
  configurable: true
})

// Node's experimental localStorage shadows jsdom's unless a backing file is
// configured, which leaves the global undefined here. Provider effects and
// fixture pages rely on it, so give the test runtime a real in-memory one.
const memoryStorage = () => {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (key: string) => store.has(key) ? store.get(key)! : null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => { store.delete(key) },
    setItem: (key: string, value: string) => { store.set(key, String(value)) }
  }
}

if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === null) {
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true })
  if (typeof window !== "undefined") Object.defineProperty(window, "localStorage", { value: globalThis.localStorage, configurable: true })
}
