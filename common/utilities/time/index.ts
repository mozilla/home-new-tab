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
