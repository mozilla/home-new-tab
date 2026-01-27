import { useEffect, useMemo, useRef } from "react"
import { getElapsedFromBaselines, TimerStatus } from "@data/state/timer"

/**
 * Drives a smooth rotation that is deterministic across tabs.
 *
 * Key idea:
 * - Use wall clock (Date.now) every frame for smoothness.
 * - Anchor to synced baselines (startedAtMs / accumulatedMs) from shared state.
 * - Never require the store to update at 60fps.
 *
 * Timing model:
 * - When Running:
 *     elapsedNow = accumulatedMs + (Date.now() - startedAtMs)
 * - When not Running:
 *     elapsedNow = accumulatedMs
 *
 * This matches the domain timing model and avoids relying on derived elapsedMs
 * that may be sampled at a lower rate for the rest of the UI.
 *
 * Implementation note:
 * - Elapsed math is delegated to `getElapsedFromBaselines` to prevent semantic drift
 *   between lifecycle logic and visual-only animations.
 */
export function useRotation({
  isRunning,
  startedAtMs,
  accumulatedMs,
  periodMs,
  origin = "81px 81px",
}: {
  isRunning: boolean
  startedAtMs: number | null
  accumulatedMs: number
  periodMs: number
  origin?: string
}) {
  // Imperative SVG node handle (so we can cancel rAF reliably).
  const rafRef = useRef<number>(0)
  const nodeRef = useRef<SVGGElement | null>(null)

  // Compute the “frozen” rotation when paused/stopped from accumulatedMs alone.
  const frozenRotation = useMemo(() => {
    const phase = ((accumulatedMs % periodMs) + periodMs) % periodMs
    return (phase / periodMs) * 360
  }, [accumulatedMs, periodMs])

  // Small helper so the tick logic stays readable.
  const getElapsedNow = () => {
    return getElapsedFromBaselines({
      status: isRunning ? TimerStatus.Running : TimerStatus.Paused,
      startedAtMs,
      accumulatedMs,
      nowMs: Date.now(),
    })
  }

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    // Always cancel any prior loop before starting a new one.
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const tick = () => {
      const elapsedNow = getElapsedNow()
      const phase = ((elapsedNow % periodMs) + periodMs) % periodMs
      const rotation = (phase / periodMs) * 360

      node.style.transformOrigin = origin
      node.style.transform = `rotate(${rotation}deg)`

      // Only animate continuously while running.
      if (isRunning) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    // Paint immediately (prevents a one-frame stale pose on state changes).
    tick()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isRunning, startedAtMs, accumulatedMs, periodMs, origin])

  // Imperative driver: keep your same “attach” API.
  function attach(node: SVGGElement | null) {
    nodeRef.current = node

    // If we attach late, immediately paint a correct pose.
    if (!node) return

    // Respect caller-provided origin consistently.
    node.style.transformOrigin = origin
    node.style.transform = `rotate(${frozenRotation}deg)`
  }

  return { attach }
}
