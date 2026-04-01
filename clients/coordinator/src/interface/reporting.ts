import { createBufferedLogger } from "@common/utilities/logger"

import type { ErrorReport, MetricReport } from "@common/types"

const logger = createBufferedLogger({ prefix: "coordinator:reporting" })

/**
 * onReportError
 * ---
 * Dev stub for the `reportError` host callback. Logs the report so it's
 * visible during development. In production, browser core routes errors
 * to the telemetry pipeline.
 */
export function onReportError(report: ErrorReport): void {
  logger.warn("reportError", report)
}

/**
 * onReportMetric
 * ---
 * Dev stub for the `reportMetric` host callback. Logs the report so it's
 * visible during development. In production, browser core routes metrics
 * through Glean and the OHTTP channel.
 */
export function onReportMetric(report: MetricReport): void {
  logger.info("reportMetric", report)
}
