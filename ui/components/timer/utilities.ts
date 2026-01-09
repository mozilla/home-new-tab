import { useMemo } from "react"
import { useTimers } from "@data/state/timer"

export function useTimerMaybe(id: string | null) {
  return useTimers((s) => (id ? (s.timers.get(id) ?? null) : null))
}

/**
 * Convenience hook that returns a memoized bound handle for an id.
 * The handle methods are stable and call through to the current store.
 */
export function useTimerActions(id: string | null) {
  const bind = useMemo(() => useTimers.getState().bind, [])
  return useMemo(() => {
    if (!id) {
      return {
        start: () => {},
        pause: () => {},
        resume: () => {},
        reset: () => {},
        setLabel: (_: string) => {},
        dispose: () => {},
      }
    }
    // bind(id) is stable API that targets the current store
    const h = bind(id)
    return {
      start: h.start,
      pause: h.pause,
      reset: h.reset,
      setLabel: h.setLabel,
      dispose: h.dispose,
    }
  }, [id, bind])
}
