import { useEffect, type RefObject } from "react"

// Tracks elements that have already triggered. WeakSet entries are garbage
// collected when the element is removed from the DOM, so each new mount of
// the same component (new DOM node) starts fresh.
const triggered = new WeakSet<Element>()

/**
 * Calls `onIntersect` once when the observed element reaches the given
 * intersection threshold. Visibility-aware: if the page is hidden on mount,
 * observation begins after the next `visibilitychange` to visible.
 *
 * `onIntersect` must be stable across renders (wrap with `useCallback`).
 * The hook does not memoize it internally.
 */
export function useIntersectionObserver(
  ref: RefObject<Element | null>,
  onIntersect: () => void,
  options?: { threshold?: number },
): void {
  const threshold = options?.threshold ?? 0.5

  useEffect(() => {
    const element = ref.current
    if (!element || triggered.has(element)) return

    let observer: IntersectionObserver | null = null

    function startObserving() {
      observer = new IntersectionObserver(
        (entries, obs) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              triggered.add(entry.target)
              obs.unobserve(entry.target)
              onIntersect()
            }
          }
        },
        { threshold },
      )
      observer.observe(element!)
    }

    function onVisible() {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", onVisible)
        startObserving()
      }
    }

    if (document.visibilityState === "hidden") {
      document.addEventListener("visibilitychange", onVisible)
    } else {
      startObserving()
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      observer?.disconnect()
    }
  }, [ref, onIntersect, threshold])
}
