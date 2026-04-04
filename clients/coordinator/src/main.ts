import { createBufferedLogger } from "@common/utilities/logger"
import { isJsModulePath } from "@common/utilities/values"
import { BASIS, inRange } from "@common/utilities/versions"
import { REMOTE_PREFIX, DATA_SCHEMA_VERSION } from "./constants"
import {
  getDataPayload,
  assembleBlockingData,
  deliverDeferredSources,
  refreshCacheForNextSession,
  shouldDataUpdate,
} from "./data-cache"
import {
  onBlockUrl,
  onBookmarkUrl,
  onDeleteBookmark,
  onDeleteHistory,
  onMessageBlocked,
  onMessageCompleted,
  onMessageDismissed,
  onMessageImpressed,
  onOpenLink,
  onPinSite,
  onReportContent,
  onReportError,
  onReportMetric,
  onSearchHandoff,
  onSectionBlocked,
  onSectionFollowed,
  onSectionUnfollowed,
  onSpocFlightBlocked,
  onSpocTileBlocked,
  onSpocUrlBlocked,
  onUnpinSite,
  onUserDataDeletion,
} from "./interface"
import {
  configureRemoteSettings,
  createDevRemoteSettings,
} from "./remote-settings"
import {
  resolveRenderers,
  fetchRemoteManifest,
  cacheRenderer,
} from "./renderer-cache"
import { mountRendererFromUrl, validateRendererModule } from "./renderer-loader"

import type {
  CoordinatedData,
  CoordinatedPayload,
  DataSourceStatuses,
  LocaleAvailability,
  LocaleFacet,
  RendererInitArgs,
  TranslationRecord,
} from "@common/types"

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
    const res = await fetch(
      `/api/l10n/translations/${l10nHash}/${locale}${params}`,
    )
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
    return {
      locale: "en-US",
      availability: "full",
      completeness: 1,
      l10nHash,
      fallbackLocales: [],
    }
  }
  const completeness =
    record.totalKeyCount > 0
      ? record.translatedKeyCount / record.totalKeyCount
      : 1
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
 * 1. **Resolve** — renderer candidates are resolved and blocking data sources
 *    are assembled in parallel. The best available renderer is chosen (cached
 *    remote if schema matches, otherwise the bundled fallback).
 *
 * 2. **Mount** — the renderer is mounted immediately with blocking data and an
 *    explicit source status map. Deferred sources (weather, discovery, spocs,
 *    wallpapers) fire independently after mount and deliver via update().
 *
 * 3. **SWR + renderer cache** — if the payload is old enough, a background
 *    refresh writes to cache for the next session (no update() push). The
 *    remote renderer manifest is checked and pre-cached if it has changed.
 */
async function boot() {
  // Resolve renderer candidates and blocking data in parallel.
  const [resolvedRenderers, blocking] = await Promise.all([
    resolveRenderers(),
    assembleBlockingData(),
  ])

  logger.info("resolved renderers", resolvedRenderers)
  logger.info("blocking data assembled", blocking)

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

  // Check the cached payload timestamp to decide if an SWR refresh should fire.
  const dataPayload: CoordinatedPayload | null = await getDataPayload()
  const shouldRefreshCache = dataPayload ? shouldDataUpdate(dataPayload) : true

  // Assemble init args. Bridges route to platform APIs — stubs that log for now.
  const { l10nHash = "", baselineFtlFile } = baseline.manifest
  const locale = resolveLocale()
  const partial = new URLSearchParams(location.search).get("partial") === "true"
  const record =
    locale !== "en-US"
      ? await fetchTranslationRecord(l10nHash, locale, partial)
      : null
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
        const baseUrl = baseline.jsUrl.substring(
          0,
          baseline.jsUrl.lastIndexOf("/"),
        )
        return fetch(`${baseUrl}/${baselineFtlFile}`).then((r) => r.text())
      }
      logger.log("getMessages: no FTL available", { requestedLocale })
      return Promise.resolve("")
    },
    reportError: onReportError,
    reportMetric: onReportMetric,
    blockUrl: onBlockUrl,
    bookmarkUrl: onBookmarkUrl,
    deleteBookmark: onDeleteBookmark,
    deleteHistory: onDeleteHistory,
    openLink: onOpenLink,
    reportContent: onReportContent,
    pinSite: onPinSite,
    unpinSite: onUnpinSite,
    searchHandoff: onSearchHandoff,
    messageImpressed: onMessageImpressed,
    messageDismissed: onMessageDismissed,
    messageCompleted: onMessageCompleted,
    messageBlocked: onMessageBlocked,
    sectionFollowed: onSectionFollowed,
    sectionUnfollowed: onSectionUnfollowed,
    sectionBlocked: onSectionBlocked,
    spocUrlBlocked: onSpocUrlBlocked,
    spocFlightBlocked: onSpocFlightBlocked,
    spocTileBlocked: onSpocTileBlocked,
    userDataDeletion: onUserDataDeletion,
  }

  // Mount with blocking data and the initial status map.
  // Sources with warm caches are already "ready"; only cold sources are "pending".
  const { update } = await mountRendererFromUrl(
    baseline.jsUrl,
    {
      manifest: baseline.manifest,
      renderUpdate: false,
      isCached: baseline.isCached,
      isStaleData: shouldRefreshCache,
      timeToStaleData: dataPayload?.updatedAt,
      initialState: blocking.data,
      sourceStatuses: blocking.statuses,
    },
    initArgs,
  )

  logger.log("renderer mounted", { statuses: blocking.statuses, pending: blocking.pendingKeys })

  // Accumulate deferred source data and statuses, delivering each via update()
  // as it resolves. Each call carries the full merged state so the renderer
  // always has a complete picture.
  const accumulatedData: Partial<CoordinatedData> = { ...blocking.data }
  const accumulatedStatuses: DataSourceStatuses = { ...blocking.statuses }

  deliverDeferredSources(blocking.pendingKeys, (key, data, status) => {
    if (data) Object.assign(accumulatedData, data)
    accumulatedStatuses[key] = status

    logger.info(`deferred source resolved: ${key}`, { status, data })

    if (update) {
      update({
        manifest: baseline.manifest,
        renderUpdate: false,
        isCached: baseline.isCached,
        isStaleData: shouldRefreshCache,
        initialState: accumulatedData,
        sourceStatuses: accumulatedStatuses,
      })
    }
  })

  // SWR: write a fresh cache for the next session if the payload is old enough.
  // Does not push to the live renderer — the user's current session is not disrupted.
  if (shouldRefreshCache) {
    logger.info("data is old, refreshing cache for next session")
    void refreshCacheForNextSession()
  } else {
    logger.info("data is fresh, no cache refresh needed")
  }

  // SWR: prepare a new renderer bundle for the next load.
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
        isStaleData: shouldRefreshCache,
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
      isStaleData: shouldRefreshCache,
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

configureRemoteSettings(createDevRemoteSettings())
boot().catch((e) => logger.error("boot: fatal error", e))

// So we can make an explicit call to capture the log buffer
declare global { interface Window { hntLog?: typeof logger.display } } //prettier-ignore
window.hntLog = logger.display
