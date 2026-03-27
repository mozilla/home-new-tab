export type ReportSource = "state" | "coordinator" | "renderer" | "l10n"

export type ErrorReport = {
  /** Subsystem that produced this error. */
  source: ReportSource
  /** Where in the subsystem the error occurred (e.g. function or component name). */
  context: string
  /** Human-readable description of what went wrong. */
  reason: string
  /** Impact level: warning (degraded), error (broken), fatal (unrecoverable). */
  severity: "warning" | "error" | "fatal"
  /** Additional diagnostic payload (stack traces, state snapshots, etc.). */
  detail?: unknown
}

export type MetricReport = {
  /** Subsystem that produced this metric. */
  source: ReportSource
  /** Metric identifier (e.g. "render-time", "fetch-count"). */
  name: string
  /** Measured value. */
  value: number
  /** Unit of measurement. */
  unit: "ms" | "count" | "ratio"
  /** Key-value pairs for slicing (e.g. { component: "weather" }). */
  dimensions?: Record<string, string>
}
