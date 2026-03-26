export type ReportSource = "state" | "coordinator" | "renderer" | "l10n"

export type ErrorReport = {
  source: ReportSource
  context: string
  reason: string
  severity: "warning" | "error" | "fatal"
  detail?: unknown
}

export type MetricReport = {
  source: ReportSource
  name: string
  value: number
  unit: "ms" | "count" | "ratio"
  dimensions?: Record<string, string>
}
