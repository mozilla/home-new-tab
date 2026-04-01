import { createBufferedLogger } from "@common/utilities/logger"
import { postEvent } from "./_post"

import type { ErrorReport } from "@common/types"

const logger = createBufferedLogger({
  prefix: "Bridge:Error-reporting",
  shouldBuffer: false,
  colors: { log: "#ff6c11" },
})

/**
 * onReportError
 * ---
 * Dev stub for the `reportError` host callback. Logs the report so it's
 * visible during development. In production, browser core routes errors
 * to the telemetry pipeline.
 */
export function onReportError(report: ErrorReport): void {
  logger.warn("reportError", report)
  postEvent("reportError", report)
}
