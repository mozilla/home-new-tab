import { createBufferedLogger } from "@common/utilities/logger"
import { isJsModulePath } from "@common/utilities/values"
import { BASIS, inRange } from "@common/utilities/versions"
import { createDevBrowserCore } from "./adapters/browser-core"
import { createStorageAdapter } from "./adapters/storage"
import { createDevTelemetry } from "./adapters/telemetry"
import { REMOTE_PREFIX, DATA_SCHEMA_VERSION } from "./constants"
import {
  getDataPayload,
  getOrFetchSchema,
  assembleBlockingData,
  deliverDeferredSources,
  warmStaleCaches,
  refreshCacheForNextSession,
  clearSourceCache,
  expireSourceCache,
  shouldDataUpdate,
} from "./data-cache"
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
  DataSourceStatuses,
  LocaleAvailability,
  LocaleFacet,
  RendererInitArgs,
  TranslationRecord,
} from "@common/types"
import type { SourceDescriptor } from "./data-schema"

export const logger = createBufferedLogger({
  prefix: "Coordinator: Main",
  groupLabel: "HNT Coordinator Lifecycle",
  shouldBuffer: false,
})

// Module-level schema store — populated during boot after the renderer schema
// is fetched. Dev tools (hntClearSource, hntExpireSource) read from here.
let activeSchema: SourceDescriptor[] = []

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
 * 1. **Resolve** — renderer candidates are resolved and the renderer schema
 *    is fetched from the bundle. Blocking data sources are assembled in
 *    parallel with the data payload check. The best available renderer is
 *    chosen (cached remote if schema matches, otherwise the bundled fallback).
 *
 * 2. **Mount** — the renderer is mounted immediately with blocking data and an
 *    explicit source status map. Deferred sources (weather, discovery, spocs)
 *    fire independently after mount and deliver via update().
 *
 * 3. **SWR + renderer cache** — if the payload is old enough, a background
 *    refresh writes to cache for the next session (no update() push). The
 *    remote renderer manifest is checked and pre-cached if it has changed.
 */
async function boot() {
  // Phase 1: Resolve renderer candidates, then fetch schema from the bundle.
  // Schema is required before data assembly — it declares what to fetch.
  const resolvedRenderers = await resolveRenderers()

  logger.info("resolved renderers", resolvedRenderers)

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

  // Derive the renderer base URL and fetch the schema artifact.
  const baseUrl = baseline.jsUrl.substring(0, baseline.jsUrl.lastIndexOf("/"))
  const schemaUrl = baseline.manifest.schemaFile
    ? `${baseUrl}/${baseline.manifest.schemaFile}`
    : null

  if (!schemaUrl) {
    logger.warn(
      "no schemaFile in manifest — renderer may need a rebuild. Proceeding with empty schema.",
    )
  }

  const schema = schemaUrl ? await getOrFetchSchema(schemaUrl, baseline.manifest.hash) : []
  activeSchema = schema

  logger.info("renderer schema loaded", schema)

  // Construct adapters — thin conduits to platform capabilities, no domain knowledge.
  const browserCore = createDevBrowserCore()
  const storage = createStorageAdapter()
  const telemetry = createDevTelemetry()

  // Phase 2: Check cached payload freshness and assemble blocking data in parallel.
  const { schemaFile } = baseline.manifest
  const [dataPayload, blocking] = await Promise.all([
    getDataPayload(schemaFile ?? ""),
    assembleBlockingData(schema, browserCore),
  ])
  const shouldRefreshCache = dataPayload ? shouldDataUpdate(dataPayload) : true

  logger.info("blocking data assembled", blocking)

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
        return fetch(`${baseUrl}/${baselineFtlFile}`).then((r) => r.text())
      }
      logger.log("getMessages: no FTL available", { requestedLocale })
      return Promise.resolve("")
    },
    browserCore,
    storage,
    telemetry,
  }

  // Mount with blocking data and the initial status map.
  // Sources with warm caches are already "ready"; only cold sources are "pending".
  const { update } = await mountRendererFromUrl(
    baseline.jsUrl,
    {
      manifest: baseline.manifest,
      renderUpdate: false,
      isCached: baseline.isCached,
      initialState: blocking.data,
      sourceStatuses: blocking.statuses,
      sourceCachedAt: blocking.cachedAt,
      dataSchema: schema,
    },
    initArgs,
  )

  logger.log("renderer mounted", {
    statuses: blocking.statuses,
    pending: blocking.pendingKeys,
    stale: blocking.staleKeys,
  })

  // Stale sources have data showing — warm their caches in the background without
  // pushing an update(). The next load will pick up the fresh cache as "ready".
  warmStaleCaches(schema, blocking.staleKeys)

  // Accumulate deferred source data and statuses, delivering each via update()
  // as it resolves. Each call carries the full merged state so the renderer
  // always has a complete picture.
  const accumulatedData: Partial<CoordinatedData> = { ...blocking.data }
  const accumulatedStatuses: DataSourceStatuses = { ...blocking.statuses }

  deliverDeferredSources(schema, blocking.pendingKeys, (key, data, status) => {
    if (data) Object.assign(accumulatedData, data)
    accumulatedStatuses[key] = status

    logger.info(`deferred source resolved: ${key}`, { status, data })

    if (update) {
      update({
        manifest: baseline.manifest,
        renderUpdate: false,
        isCached: baseline.isCached,
        initialState: accumulatedData,
        sourceStatuses: accumulatedStatuses,
        sourceCachedAt: blocking.cachedAt,
        dataSchema: schema,
      })
    }
  })

  // SWR: write a fresh cache for the next session if the payload is old enough.
  // Does not push to the live renderer — the user's current session is not disrupted.
  if (shouldRefreshCache) {
    logger.info("data is old, refreshing cache for next session")
    void refreshCacheForNextSession(schema, browserCore, schemaFile ?? "")
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
        dataSchema: schema,
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
      dataSchema: schema,
    })

  try {
    logger.log("validating new remote renderer", {
      remoteUrl,
      hash: remote.hash,
    })
    await validateRendererModule(remoteUrl)

    await cacheRenderer(remote)
    logger.log("cached new remote renderer for next load")

    // Pre-warm the schema cache for the new renderer so the next boot
    // serves the schema from cache rather than making a network request.
    if (remote.schemaFile) {
      const remoteSchemaUrl = `${REMOTE_PREFIX}/${remote.schemaFile}`
      await getOrFetchSchema(remoteSchemaUrl, remote.hash)
      logger.log("pre-cached schema for next renderer", remote.hash)
    }
  } catch (e) {
    logger.error("validation/cache failed for remote renderer", e)
  }
}

configureRemoteSettings(createDevRemoteSettings())
boot().catch((e) => logger.error("boot: fatal error", e))

// Dev tools exposed on window for manual testing.
// hntLog: flush the coordinator log buffer to the console.
// hntClearSource: backdate a deferred source cache entry to stale (data preserved, TTL exceeded).
// hntExpireSource: delete a deferred source cache entry entirely (simulates max-age cold start).
declare global {
  interface Window {
    hntLog?: typeof logger.display
    hntClearSource?: (
      key: "weather" | "discovery" | "sponsored",
    ) => Promise<void>
    hntExpireSource?: (
      key: "weather" | "discovery" | "sponsored",
    ) => Promise<void>
  }
}
window.hntLog = logger.display
window.hntClearSource = async (key) => {
  await clearSourceCache(activeSchema, key)
  logger.info(
    `hntClearSource: "${key}" backdated to stale — reload to observe warm-cache path`,
  )
}
window.hntExpireSource = async (key) => {
  await expireSourceCache(activeSchema, key)
  logger.info(
    `hntExpireSource: "${key}" deleted — reload to observe the pending/deferred pipeline`,
  )
}
