import { useState, useEffect, useMemo } from "react"

/**
 * useCountdownSeconds
 * ---
 * Returns whole seconds remaining until a "stale" moment, clamped to [0..N].
 *
 * Assumes `timeToStaleData` is a "last updated" timestamp (ISO string).
 * Stale time is computed as: Date.parse(timeToStaleData) + intervalTime
 *
 * - Initializes to the real value (no 60 → computed thrashing)
 * - Ticks immediately, then every 1_000
 * - Stops ticking once it hits 0
 */
export function useCountdownSeconds(
  timeToStaleData?: string,
  intervalTime: number = 60_000,
) {
  // Compute a stable "staleAt" moment derived from the timestamp + intervalTime.
  // If the timestamp is missing or invalid, treat "now" as lastUpdated.
  const staleAtMs = useMemo(() => {
    const parsed = timeToStaleData ? Date.parse(timeToStaleData) : NaN
    const lastUpdatedMs = Number.isFinite(parsed) ? parsed : Date.now()
    return lastUpdatedMs + intervalTime
  }, [timeToStaleData, intervalTime])

  const computeRemainingSeconds = () => {
    return Math.max(0, Math.ceil((staleAtMs - Date.now()) / 1000))
  }

  // Initialize from the “real” value so first paint is correct.
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    computeRemainingSeconds(),
  )

  // If staleAt changes, snap immediately (avoids showing stale number between renders).
  useEffect(() => {
    setSecondsRemaining(computeRemainingSeconds())
  }, [staleAtMs])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    const tick = () => {
      const remaining = computeRemainingSeconds()
      setSecondsRemaining(remaining)

      if (remaining === 0 && intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    tick()
    intervalId = setInterval(tick, 1_000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [staleAtMs])

  return secondsRemaining
}

export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))

  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = clamped % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)

  return parts.join(" ")
}
