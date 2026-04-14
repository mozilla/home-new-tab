import type { TelemetryAdapter } from "@common/types"
import type { ErrorReport, MetricReport } from "@common/types"

/**
 * Returns a TelemetryAdapter that logs to the console and POSTs to the dev API.
 * In production, routes to the platform's Glean/OHTTP telemetry channel.
 */
export function createDevTelemetry(): TelemetryAdapter {
  return {
    reportError(report: ErrorReport): void {
      console.warn("[telemetry] reportError", report)
      void globalThis
        .fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "error", ...report }),
        })
        .catch(() => {})
    },

    reportMetric(report: MetricReport): void {
      console.log("[telemetry] reportMetric", report)
      void globalThis
        .fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "metric", ...report }),
        })
        .catch(() => {})
    },
  }
}
