import { useState, useEffect, useMemo } from "react"

/** Milliseconds until cached data is considered TTL-expired. */
export const DATA_TTL_MS = 60_000

/**
 * Per-source TTL values — how long before a source's cache is eligible for refresh.
 * Mirror the coordinator-side constants. Adjust both together when calibrating.
 */
export const SOURCE_TTL_MS: Partial<Record<string, number>> = {
  weather: 600_000, // 10 minutes
  discovery: 1_800_000, // 30 minutes
  sponsored: 1_800_000, // 30 minutes
}

/**
 * Per-source max-age values — how long before a source's cache is dropped on load.
 * Mirror the coordinator-side constants. Adjust both together when calibrating.
 */
export const SOURCE_MAX_AGE_MS: Partial<Record<string, number>> = {
  weather: 3_600_000, // 1 hour
  discovery: 86_400_000, // 24 hours
  sponsored: 86_400_000, // 24 hours
}

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
): number | null {
  // Compute a stable "staleAt" moment derived from the timestamp + intervalTime.
  // Returns null when no timestamp is provided — callers get an explicit signal
  // rather than a bogus countdown computed from Date.now().
  const staleAtMs = useMemo((): number | null => {
    if (timeToStaleData === undefined) return null
    const parsed = Date.parse(timeToStaleData)
    if (!Number.isFinite(parsed)) return null
    return parsed + intervalTime
  }, [timeToStaleData, intervalTime])

  const computeRemainingSeconds = (): number | null => {
    if (staleAtMs === null) return null
    return Math.max(0, Math.ceil((staleAtMs - Date.now()) / 1000))
  }

  // Initialize from the "real" value so first paint is correct.
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() =>
    computeRemainingSeconds(),
  )

  // If staleAt changes, snap immediately (avoids showing stale number between renders).
  useEffect(() => {
    setSecondsRemaining(computeRemainingSeconds())
  }, [staleAtMs])

  useEffect(() => {
    if (staleAtMs === null) return

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

/**
 * useElapsedSeconds
 * ---
 * Returns whole seconds elapsed since a given timestamp, incrementing every second.
 * Returns null when no timestamp is provided.
 */
export function useElapsedSeconds(since?: string): number | null {
  const sinceMs = useMemo((): number | null => {
    if (since === undefined) return null
    const parsed = Date.parse(since)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }, [since])

  const [secondsElapsed, setSecondsElapsed] = useState<number | null>(() => {
    if (sinceMs === null) return null
    return Math.max(0, Math.floor((Date.now() - sinceMs) / 1000))
  })

  useEffect(() => {
    if (sinceMs === null) {
      setSecondsElapsed(null)
      return
    }
    setSecondsElapsed(Math.max(0, Math.floor((Date.now() - sinceMs) / 1000)))
  }, [sinceMs])

  useEffect(() => {
    if (sinceMs === null) return
    const tick = () =>
      setSecondsElapsed(Math.max(0, Math.floor((Date.now() - sinceMs) / 1000)))
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [sinceMs])

  return secondsElapsed
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
