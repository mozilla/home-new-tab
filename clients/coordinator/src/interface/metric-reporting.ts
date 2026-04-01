import { createBufferedLogger } from "@common/utilities/logger"
import { postEvent } from "./_post"

import type { MetricReport } from "@common/types"

const logger = createBufferedLogger({
  prefix: "Bridge:Metric-reporting",
  shouldBuffer: false,
  colors: { log: "#ff6c11" },
})

/**
 * onReportMetric
 * ---
 * Dev stub for the `reportMetric` host callback. Logs the report so it's
 * visible during development. In production, browser core routes metrics
 * through Glean and the OHTTP channel.
 */
export function onReportMetric(report: MetricReport): void {
  logger.info("reportMetric", report)
  postEvent("reportMetric", report)
}
