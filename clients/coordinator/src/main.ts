import { createBufferedLogger } from "@common/utilities/logger"
import { isJsModulePath } from "@common/utilities/values"
import { BASIS, inRange } from "@common/utilities/versions"
import { REMOTE_PREFIX, DATA_SCHEMA_VERSION } from "./constants"
import {
  getDataPayload,
  refreshDataForNextSession,
  isDataStale,
  shouldDataUpdate,
} from "./data-cache"
import {
  resolveRenderers,
  fetchRemoteManifest,
  cacheRenderer,
} from "./renderer-cache"
import { mountRendererFromUrl, validateRendererModule } from "./renderer-loader"

import type {
  CoordinatedPayload,
  LocaleAvailability,
  LocaleFacet,
  RendererInitArgs,
  TranslationRecord,
} from "@common/types"

/**
 * Just some helper functions that will go away once the discovery phase is over
 * but add some flavor to the logging.
 */
export const logger = createBufferedLogger({
  prefix: "Coordinator: Main",
  groupLabel: "HNT Coordinator Lifecycle",
  shouldBuffer: false,
})

/**
 * Resolves the active locale for this session.
 * Reads from a `?locale=` URL param first (dev/testing override), then `navigator.language`.
 */
function resolveLocale(): string {
  const override = new URLSearchParams(location.search).get("locale")
  if (override) return override
  return navigator.language || "en-US"
}

/**
 * Fetches a TranslationRecord from the dev API for the given hash and locale.
 * Returns null if no record exists (404) or if the request fails.
 * Pass `partial=true` to simulate partial translation coverage.
 */
async function fetchTranslationRecord(
  l10nHash: string,
  locale: string,
  partial: boolean = false,
): Promise<TranslationRecord | null> {
  try {
    const params = partial ? "?partial=true" : ""
    const res = await fetch(`/api/l10n/translations/${l10nHash}/${locale}${params}`)
    if (!res.ok) return null
    return res.json() as Promise<TranslationRecord>
  } catch {
    return null
  }
}

/**
 * Derives a LocaleFacet from a translation record lookup result.
 * Falls back to en-US full availability when no record is found.
 */
function buildLocaleFacet(
  l10nHash: string,
  locale: string,
  record: TranslationRecord | null,
): LocaleFacet {
  if (!record) {
    return { locale: "en-US", availability: "full", completeness: 1, l10nHash, fallbackLocales: [] }
  }
  const completeness =
    record.totalKeyCount > 0 ? record.translatedKeyCount / record.totalKeyCount : 1
  const availability: LocaleAvailability =
    completeness >= 1 ? "full" : completeness > 0 ? "partial" : "none"
  return {
    locale,
    availability,
    ...(availability === "partial" ? { completeness } : {}),
    l10nHash,
    fallbackLocales: ["en-US"],
  }
}

/**
 * Run the coordinator boot sequence.
 *
 * Three phases happen in order:
 *
 * 1. **Resolve** — renderer candidates and coordinated data are fetched in
 *    parallel. The best available renderer is chosen (cached remote if schema
 *    matches, otherwise the bundled fallback).
 *
 * 2. **SWR** — if data is missing or stale, we block and fetch fresh data now.
 *    If data is merely old enough to warrant a refresh, we kick that off in
 *    the background so the next load benefits without blocking this one.
 *
 * 3. **Mount + cache** — the renderer is mounted with the assembled init args
 *    and coordinated data. After mount, the remote manifest is checked and the
 *    next renderer bundle is pre-cached if it has changed.
 */
async function boot() {
  // Resolve "best renderer" and "best coordinated data" in parallel.
  const rendererPromise = resolveRenderers()
  const dataPromise = getDataPayload()

  const [resolvedRenderers, dataPayload] = await Promise.all([
    rendererPromise,
    dataPromise,
  ])

  logger.info("resolved renderers", resolvedRenderers)
  logger.info("data payload", dataPayload)

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
  const hasDataCache = Boolean(dataPayload)
  const isFirstLoad = !hasRendererCache && !hasDataCache

  // Check if data is stale
  const stale = dataPayload ? isDataStale(dataPayload) : false
  const shouldBlockForFreshData = isFirstLoad || stale
  const shouldUpdateData = dataPayload ? shouldDataUpdate(dataPayload) : false

  let coordinatedForThisSession: CoordinatedPayload | null = dataPayload

  if (shouldBlockForFreshData) {
    logger.info("blocking for fresh coordinated payload", { isFirstLoad, stale }) // prettier-ignore
    await refreshDataForNextSession()
    coordinatedForThisSession = await getDataPayload()
  } else {
    logger.info("using cached coordinated payload") // prettier-ignore
    if (shouldUpdateData) {
      logger.info("data is old, updating data for next render without blocking")
      void refreshDataForNextSession()
    } else {
      logger.info("data is fresh, no data updates at this time")
    }
  }

  // Assemble init args. Bridges route to platform APIs — stubs that log for now.
  const { l10nHash = "", baselineFtlFile } = baseline.manifest
  const locale = resolveLocale()
  const partial = new URLSearchParams(location.search).get("partial") === "true"
  const record = locale !== "en-US" ? await fetchTranslationRecord(l10nHash, locale, partial) : null
  const localeFacet = buildLocaleFacet(l10nHash, locale, record)

  const initArgs: RendererInitArgs = {
    gatingPayload: {
      locale: localeFacet,
      flags: {},
    },
    getMessages: (requestedLocale: string) => {
      if (record && requestedLocale !== "en-US") {
        return fetch(record.resource).then((r) => r.text())
      }
      if (baselineFtlFile) {
        // Derive renderer base URL from jsUrl by stripping the filename.
        const baseUrl = baseline.jsUrl.substring(0, baseline.jsUrl.lastIndexOf("/"))
        return fetch(`${baseUrl}/${baselineFtlFile}`).then((r) => r.text())
      }
      logger.log("getMessages: no FTL available", { requestedLocale })
      return Promise.resolve("")
    },
    reportError: (report) => logger.warn("reportError", report),
    reportMetric: (report) => logger.info("reportMetric", report),
  }

  // Single mount per load: baseline renderer with coordinated data.
  const { update } = await mountRendererFromUrl(
    baseline.jsUrl,
    {
      manifest: baseline.manifest,
      renderUpdate: false,
      isCached: baseline.isCached,
      isStaleData: shouldUpdateData,
      timeToStaleData: coordinatedForThisSession?.updatedAt,
      initialState: coordinatedForThisSession?.data ?? {},
    },
    initArgs,
  )

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
        renderUpdate: false,
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
      renderUpdate: true,
      nextHash: remote.hash,
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
declare global { interface Window { hntLog?: typeof logger.display } } //prettier-ignore
window.hntLog = logger.display
