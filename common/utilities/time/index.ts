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
