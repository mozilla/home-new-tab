import { useEffect, useMemo, useRef, useState } from "react"
import { timer } from "@data/state/timer"
import { TimerStatus } from "@data/state/timer/types"

/**
 * useThrottledNowMs
 * ---
 * UI sampling clock (React-driven) for timer display + policy reconciliation.
 *
 * Goals:
 * - Update React at a bounded rate (maxFps / minIntervalMs).
 * - Only tick while the timer is Running.
 * - Pause ticking while the document is hidden (tab inactive) to save work.
 * - Resume promptly on visibility change (no "stale visible" bug).
 *
 * Notes:
 * - This is NOT the animation clock. SVG/rAF visuals can use Date.now() directly.
 * - The store remains the authoritative baseline; this just drives UI refresh.
 */
export function useThrottledNowMs(opts?: {
  maxFps?: number
  minIntervalMs?: number
}) {
  const maxFps = opts?.maxFps ?? 30
  const minIntervalMs = opts?.minIntervalMs ?? 250

  const [nowMs, setNowMs] = useState(() => Date.now())

  const gateMs = useMemo(() => {
    const minByFps = 1000 / maxFps
    return Math.max(minIntervalMs, minByFps)
  }, [maxFps, minIntervalMs])

  const status = timer.useStore((s) => s.shared.data.status)

  const lastTickRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const clearTimer = () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const isVisible = () =>
      typeof document === "undefined" ? true : !document.hidden

    const shouldTick = () => isVisible() && status === TimerStatus.Running

    const tick = () => {
      if (cancelled) return

      // If conditions changed since scheduling, stop cleanly.
      if (!shouldTick()) {
        clearTimer()
        return
      }

      const now = Date.now()
      const elapsed = now - lastTickRef.current

      // First paint / resume: lastTickRef might be 0 or stale.
      if (lastTickRef.current === 0 || elapsed >= gateMs) {
        lastTickRef.current = now
        setNowMs(now)
      }

      timeoutRef.current = window.setTimeout(tick, gateMs)
    }

    const start = () => {
      if (cancelled) return
      if (!shouldTick()) return

      // On start/resume, force a near-immediate update so UI catches up.
      // (Avoids "wait up to gateMs" on visibility regain.)
      lastTickRef.current = 0
      clearTimer()
      tick()
    }

    const stop = () => clearTimer()

    const onVisibilityChange = () => (shouldTick() ? start() : stop())

    // Initial decision on mount / when deps change.
    if (shouldTick()) start()
    else stop()

    // React to tab visibility changes while status remains Running.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange)
    }

    return () => {
      cancelled = true
      stop()
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }
    }
  }, [status, gateMs])

  return nowMs
}
