import "@testing-library/jest-dom/vitest"
import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useIntersectionObserver } from "."

// Minimal IntersectionObserver mock. Tests call `triggerEntry` to simulate
// the browser firing an intersection event.
type MockObserver = {
  observe: ReturnType<typeof vi.fn>
  unobserve: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  triggerEntry: (isIntersecting: boolean) => void
}

let lastObserver: MockObserver | null = null

function setupIntersectionObserverMock() {
  lastObserver = null

  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn().mockImplementation((callback: IntersectionObserverCallback) => {
      let observedTarget: Element | null = null
      const observer: MockObserver = {
        observe: vi.fn((target: Element) => {
          observedTarget = target
        }),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        triggerEntry: (isIntersecting: boolean) => {
          if (!observedTarget) return
          callback(
            [
              {
                target: observedTarget,
                isIntersecting,
                intersectionRatio: isIntersecting ? 1 : 0,
              } as IntersectionObserverEntry,
            ],
            observer as unknown as IntersectionObserver,
          )
        },
      }
      lastObserver = observer
      return observer
    }),
  )
}

describe("useIntersectionObserver", () => {
  beforeEach(() => {
    setupIntersectionObserverMock()
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("calls onIntersect when the element reaches the threshold", () => {
    const onIntersect = vi.fn()
    const element = document.createElement("div")
    const ref = { current: element }

    renderHook(() => useIntersectionObserver(ref, onIntersect))

    expect(lastObserver!.observe).toHaveBeenCalledWith(element)
    lastObserver!.triggerEntry(true)
    expect(onIntersect).toHaveBeenCalledTimes(1)
  })

  it("does not call onIntersect when ratio is below threshold", () => {
    const onIntersect = vi.fn()
    const element = document.createElement("div")
    const ref = { current: element }

    renderHook(() => useIntersectionObserver(ref, onIntersect))

    lastObserver!.triggerEntry(false)
    expect(onIntersect).not.toHaveBeenCalled()
  })

  it("unobserves the element after the first intersection", () => {
    const onIntersect = vi.fn()
    const element = document.createElement("div")
    const ref = { current: element }

    renderHook(() => useIntersectionObserver(ref, onIntersect))

    lastObserver!.triggerEntry(true)
    expect(lastObserver!.unobserve).toHaveBeenCalledWith(element)
  })

  it("does not fire again for an element that already triggered", () => {
    const onIntersect = vi.fn()
    // Use a fresh element for the first render.
    const element = document.createElement("div")
    const ref = { current: element }

    const { rerender } = renderHook(() =>
      useIntersectionObserver(ref, onIntersect),
    )

    // Trigger once.
    lastObserver!.triggerEntry(true)
    expect(onIntersect).toHaveBeenCalledTimes(1)

    // Rerender with the same element — should not set up a new observer.
    rerender()
    expect(IntersectionObserver).toHaveBeenCalledTimes(1)
    expect(onIntersect).toHaveBeenCalledTimes(1)
  })

  it("disconnects the observer on unmount", () => {
    const onIntersect = vi.fn()
    const ref = { current: document.createElement("div") }

    const { unmount } = renderHook(() =>
      useIntersectionObserver(ref, onIntersect),
    )

    const observer = lastObserver!
    unmount()
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it("does not start observing if the page is hidden on mount", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })

    const onIntersect = vi.fn()
    const ref = { current: document.createElement("div") }

    renderHook(() => useIntersectionObserver(ref, onIntersect))

    // Observer should not be created yet.
    expect(IntersectionObserver).not.toHaveBeenCalled()
    expect(onIntersect).not.toHaveBeenCalled()
  })

  it("starts observing after visibilitychange to visible", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })

    const onIntersect = vi.fn()
    const ref = { current: document.createElement("div") }

    renderHook(() => useIntersectionObserver(ref, onIntersect))

    // Simulate page becoming visible.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    })
    document.dispatchEvent(new Event("visibilitychange"))

    expect(IntersectionObserver).toHaveBeenCalledTimes(1)

    lastObserver!.triggerEntry(true)
    expect(onIntersect).toHaveBeenCalledTimes(1)
  })

  it("removes visibilitychange listener on unmount when page was hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })

    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener")
    const ref = { current: document.createElement("div") }

    const { unmount } = renderHook(() => useIntersectionObserver(ref, vi.fn()))

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    )
  })

  it("does nothing if ref has no element", () => {
    const onIntersect = vi.fn()
    const ref = { current: null }

    renderHook(() => useIntersectionObserver(ref, onIntersect))

    expect(IntersectionObserver).not.toHaveBeenCalled()
  })
})
