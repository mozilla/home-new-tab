import { createBufferedLogger } from "@common/utilities/logger"
import { postEvent } from "./_post"

const logger = createBufferedLogger({
  prefix: "Bridge:User-data",
  shouldBuffer: false,
  colors: { log: "#ff6c11" },
})

/**
 * onUserDataDeletion
 * ---
 * Dev stub for the `userDataDeletion` host callback. Signals that the user
 * has disabled ad surfaces and their MARS data should be deleted.
 *
 * In production, browser core sends a DELETE request to MARS using the
 * stored context ID. The dev stub logs the event and posts it to the API
 * for visibility.
 */
export function onUserDataDeletion(): void {
  logger.info("userDataDeletion")
  postEvent("userDataDeletion", {})
}