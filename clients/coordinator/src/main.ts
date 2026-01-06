import { createBufferedLogger } from "@common/utilities/logger"
import { isJsModulePath } from "@common/utilities/values"
import { BASIS, inRange } from "@common/utilities/versions"
import { REMOTE_PREFIX, DATA_SCHEMA_VERSION } from "./constants"
import {
  getDataSnapshot,
  refreshDataForNextSession,
  isDataStale,
  shouldDataUpdate,
} from "./data-cache"
import {
  resolveRenderers,
  mountRendererFromUrl,
  fetchRemoteManifest,
  validateRendererModule,
  cacheRenderer,
} from "./renderer-cache"

import type { CoordinatedPayload } from "@common/types"

/**
 * Just some helper functions that will go away once the discovery phase is over
 * but add some flavor to the logging.
 */
export const logger = createBufferedLogger({
  prefix: "Coordinator: Main",
  groupLabel: "HNT Coordinator Lifecycle",
  shouldBuffer: false,
})

async function boot() {
  // Resolve "best renderer" and "best coordinated data" in parallel.
  const rendererPromise = resolveRenderers()
  const dataPromise = getDataSnapshot()

  const [resolvedRenderers, dataSnapshot] = await Promise.all([
    rendererPromise,
    dataPromise,
  ])

  logger.info("resolved renderers", resolvedRenderers)
  logger.info("data snapshot", dataSnapshot)

  // Soft schema sanity check: log + warn, but don't block usage.
  const cachedRenderer = resolvedRenderers.cached
  const bundledRenderer = resolvedRenderers.bundled
  const remoteVersion = cachedRenderer?.manifest.dataSchemaVersion
  const dataMatch = inRange(DATA_SCHEMA_VERSION, remoteVersion, BASIS.major)

  const baseline =
    cachedRenderer && dataMatch
      ? { isCached: true, ...cachedRenderer }
      : { isCached: false, ...bundledRenderer }

  if (!dataMatch) {
    logger.warn(`schema mismatch — ${cachedRenderer?.manifest.dataSchemaVersion} not in range: ${DATA_SCHEMA_VERSION}`) // prettier-ignore
    logger.warn(`falling back to baked in renderer — ${bundledRenderer.manifest.hash}`) // prettier-ignore
  }

  const hasRendererCache = cachedRenderer
  const hasDataCache = Boolean(dataSnapshot)
  const isFirstLoad = !hasRendererCache && !hasDataCache

  // Check if data is stale
  const stale = dataSnapshot ? isDataStale(dataSnapshot) : false
  const shouldBlockForFreshData = isFirstLoad || stale
  const shouldUpdateData = dataSnapshot ? shouldDataUpdate(dataSnapshot) : false

  let coordinatedForThisSession: CoordinatedPayload | null = dataSnapshot

  if (shouldBlockForFreshData) {
    logger.info("blocking for fresh coordinated payload", { isFirstLoad, stale }) // prettier-ignore
    await refreshDataForNextSession()
    coordinatedForThisSession = await getDataSnapshot()
  } else {
    logger.info("using cached coordinated payload") // prettier-ignore
    if (shouldUpdateData) {
      logger.info("data is old, updating data for next render without blocking")
      void refreshDataForNextSession()
    } else {
      logger.info("data is fresh, no data updates at this time")
    }
  }

  // Single mount per load: baseline renderer with coordinated data.
  const { update } = await mountRendererFromUrl(baseline.jsUrl, {
    manifest: baseline.manifest,
    willUpdate: false,
    isCached: baseline.isCached,
    isStaleData: shouldUpdateData,
    timeToStaleData: coordinatedForThisSession?.updatedAt,
    initialState: coordinatedForThisSession?.data ?? {},
  })

  const hasCoordinatedData = coordinatedForThisSession != null
  logger.log("renderer mounted", { hasCoordinatedData })

  // SWR: prepare a new renderer bundle for the *next* load.
  const remote = await fetchRemoteManifest()
  if (!remote) {
    logger.log("no remote manifest; staying on current renderer")
    return
  }

  // !! NOTE — This doesn't account for an updated bundled
  // !! We should check the build time, not just the hash diff
  const currentHash = baseline.manifest.hash
  if (currentHash === remote.hash) {
    logger.log("remote hash matches current; no cache update")
    if (update)
      update({
        manifest: baseline.manifest,
        willUpdate: false,
        isCached: baseline.isCached,
        isStaleData: shouldUpdateData,
      })
    return
  }

  if (!isJsModulePath(remote.file)) {
    logger.warn("remote manifest.file is not JS; ignoring", remote.file)
    return
  }

  const remoteUrl = `${REMOTE_PREFIX}/${remote.file}`

  if (update)
    update({
      manifest: baseline.manifest,
      willUpdate: true,
      isCached: baseline.isCached,
      isStaleData: shouldUpdateData,
    })

  try {
    logger.log("validating new remote renderer", {
      remoteUrl,
      hash: remote.hash,
    })
    await validateRendererModule(remoteUrl)

    await cacheRenderer(remote)
    logger.log("cached new remote renderer for next load")
  } catch (e) {
    logger.error("validation/cache failed for remote renderer", e)
  }
}

boot().catch((e) => logger.error("boot: fatal error", e))

// So we can make an explicit call to capture the log buffer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).hntLog = logger.display
