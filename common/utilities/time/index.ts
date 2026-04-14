export function msToMinutes(ms: number) {
  return Math.round((ms / 60_000) * 100) / 100
}

export function minutesToMs(minutes: number) {
  return Math.max(0, Math.round(minutes * 60_000))
}

export function parseNumber(input: string) {
  const n = Number(input)
  return Number.isFinite(n) ? n : null
}

export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0
  if (denominator <= 0) return 0
  return numerator / denominator
}

export function formatMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/**
 * formatMs
 * ---
 * Formats a millisecond duration as a compact human-readable string using the
 * largest applicable unit: days, hours, minutes, or milliseconds. Fractional
 * values are preserved (e.g. 90 minutes → "1.5h"). Useful for displaying
 * cache TTLs and time intervals in debug panels (wink wink ... guess what we us it for)
 */
export function formatMs(ms: number): string {
  if (ms >= 86_400_000) return `${ms / 86_400_000}d`
  if (ms >= 3_600_000) return `${ms / 3_600_000}h`
  if (ms >= 60_000) return `${ms / 60_000}m`
  return `${ms}ms`
}

/**
 * getElapsedFromBaselines
 * ---------------------------------------------------------
 * Computes elapsed time from timer baselines.
 *
 * Timing model:
 * - When running: accumulatedMs + (nowMs - startedAtMs)
 * - When not running: accumulatedMs
 *
 * Safety: Negative deltas clamped to 0 (clock skew, tab suspension)
 */
export function getElapsedFromBaselines(args: {
  isRunning: boolean
  startedAtMs: number | null
  accumulatedMs: number
  nowMs: number
}): number {
  const runningDelta =
    args.isRunning && args.startedAtMs != null
      ? Math.max(0, args.nowMs - args.startedAtMs)
      : 0

  return Math.max(0, args.accumulatedMs + runningDelta)
}

/**
 * getRunningDelta
 * ---------------------------------------------------------
 * Returns accumulated time plus in-progress delta for running timer.
 *
 * Purpose: Banking logic for pause/completion transitions.
 *
 * Safety: Negative values clamped to 0.
 */
export function getRunningDelta(args: {
  isRunning: boolean
  startedAtMs: number | null
  accumulatedMs: number
  nowMs: number
}): number {
  if (!args.isRunning || args.startedAtMs == null) {
    return args.accumulatedMs
  }

  return args.accumulatedMs + Math.max(0, args.nowMs - args.startedAtMs)
}

/**
 * formatIsoCalendarDate
 * ---
 * Formats an ISO timestamp that semantically represents a calendar date.
 *
 * Why this exists:
 * - ISO strings at 00:00:00Z drift when rendered in local timezones
 * - We want deterministic calendar rendering across tabs/devices
 *
 * Example:
 * formatIsoCalendarDate("2026-01-02T00:00:00Z")
 * → "January 2, 2026"
 */
export function formatIsoCalendarDate(iso: string, locale = "en-US"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) throw new Error(`Invalid ISO calendar date: ${iso}`)

  const [_, y, mo, d] = m
  const date = new Date(`${y}-${mo}-${d}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${iso}`)

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}
