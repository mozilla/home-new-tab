import style from "./style.module.css"

import { useState } from "react"
import { JsonNode } from "./json-tree"
import {
  DATA_TTL_MS,
  SOURCE_TTL_MS,
  formatDuration,
  useCountdownSeconds,
} from "./timers.hook"
import { useBridges } from "@data/state/coordinator-interface"

import type {
  AppProps,
  DataSourceStatus,
  DataSourceStatuses,
  DataSourceTimestamps,
} from "@common/types"

declare global {
  interface Window {
    hntClearSource?: (
      key: "weather" | "discovery" | "sponsored",
    ) => Promise<void>
  }
}

const STATUS_LABEL: Record<DataSourceStatus, string> = {
  pending: "⏳",
  stale: "↻",
  ready: "✓",
  failed: "✗",
}

/**
 * Derives effective source statuses by checking per-source TTL at render time.
 * Sources marked "ready" are flipped to "stale" if their cached timestamp is
 * older than the source's TTL. Local overrides (e.g. manual invalidations) take
 * precedence over both.
 */
function deriveEffectiveStatuses(
  sourceStatuses: DataSourceStatuses | undefined,
  sourceCachedAt: DataSourceTimestamps | undefined,
  localStatuses: DataSourceStatuses,
): DataSourceStatuses {
  const merged: DataSourceStatuses = { ...sourceStatuses }

  for (const key of Object.keys(merged) as Array<keyof DataSourceStatuses>) {
    if (merged[key] !== "ready") continue
    const ttl = SOURCE_TTL_MS[key as string]
    const cachedAt = sourceCachedAt?.[key]
    if (ttl == null || cachedAt == null) continue
    const age = Date.now() - Date.parse(cachedAt)
    if (age > ttl) merged[key] = "stale"
  }

  return { ...merged, ...localStatuses }
}

/**
 * RendererInfo
 * ---
 * POC debug panel showing renderer and data state.
 *
 * Displays manifest metadata, cache status, per-source TTL countdowns, and
 * manual invalidation controls. Rendered by the coordinator as a self-contained
 * diagnostic surface during the discovery phase.
 */
export function RendererInfo(props: AppProps) {
  const {
    manifest,
    renderUpdate,
    nextHash,
    isCached,
    initialState,
    sourceStatuses,
    sourceCachedAt,
  } = props
  const { dataSchemaVersion, buildTime, hash } = manifest

  const bridges = useBridges()

  // Local overrides applied immediately on invalidation, before the next load.
  const [localStatuses, setLocalStatuses] = useState<DataSourceStatuses>({})

  const effectiveStatuses = deriveEffectiveStatuses(
    sourceStatuses,
    sourceCachedAt,
    localStatuses,
  )

  const handleInvalidate = async (
    key: "weather" | "discovery" | "sponsored",
  ) => {
    await window.hntClearSource?.(key)
    setLocalStatuses((prev) => ({ ...prev, [key]: "stale" }))
  }

  // --- Bridge handlers ---

  const handleReportError = () =>
    bridges?.reportError?.({
      source: "renderer",
      context: "renderer-info",
      reason: "test error",
      severity: "warning",
    })

  const handleReportMetric = () =>
    bridges?.reportMetric?.({
      source: "renderer",
      name: "test-metric",
      value: 1,
      unit: "count",
    })

  const handleBlockUrl = () => bridges?.blockUrl?.("https://example.com")
  const handleBookmarkUrl = () => bridges?.bookmarkUrl?.("https://example.com")
  const handleDeleteBookmark = () => bridges?.deleteBookmark?.("bookmark-1")
  const handleDeleteHistory = () => bridges?.deleteHistory?.("https://example.com") //prettier-ignore
  const handleOpenLink = () => bridges?.openLink?.("https://example.com", "new-tab") //prettier-ignore
  const handleReportContent = () => bridges?.reportContent?.("https://example.com") //prettier-ignore
  const handlePinSite = () => bridges?.pinSite?.("https://example.com", 0)
  const handleUnpinSite = () => bridges?.unpinSite?.("https://example.com")
  const handleSearchHandoff = () => bridges?.searchHandoff?.("test query")

  const handleMessageImpressed = () => bridges?.messageImpressed?.("msg-1")
  const handleMessageDismissed = () => bridges?.messageDismissed?.("msg-1")
  const handleMessageCompleted = () => bridges?.messageCompleted?.("msg-1")
  const handleMessageBlocked = () => bridges?.messageBlocked?.("msg-1")

  return (
    <main className={style.base} data-testid="renderer-info">
      <header className={style.title}>
        <h1 data-l10n-id="renderer-info-title" />
        <h2
          data-l10n-id="renderer-info-renderer-type"
          data-l10n-args={JSON.stringify({ cached: String(isCached) })}
        />
      </header>
      <div className={style.content}>
        <div
          className={`${style.renderer} ${renderUpdate ? style.willUpdate : ""}`}>
          <div className={style.inner}>
            <header
              data-l10n-id="renderer-info-renderer-section"
              data-l10n-args={JSON.stringify({
                updating: String(renderUpdate),
              })}
            />
            <ul className={style.innercontent}>
              <li
                data-l10n-id="renderer-info-renderer-source"
                data-l10n-args={JSON.stringify({ cached: String(isCached) })}
              />
              <li
                data-l10n-id="renderer-info-hash"
                data-l10n-args={JSON.stringify({ hash })}
              />
              {nextHash ? (
                <li
                  data-l10n-id="renderer-info-next-hash"
                  data-l10n-args={JSON.stringify({ hash: nextHash })}
                />
              ) : null}
              <li
                data-l10n-id="renderer-info-schema-version"
                data-l10n-args={JSON.stringify({ version: dataSchemaVersion })}
              />
              <li
                data-l10n-id="renderer-info-build-time"
                data-l10n-args={JSON.stringify({
                  time: new Date(buildTime).toLocaleString(),
                })}
              />
            </ul>
          </div>
        </div>
        <div className={style.state}>
          <div className={style.inner}>
            <header data-l10n-id="renderer-info-data-section" />
            <div className={style.innercontent}></div>
            {Object.entries(
              (initialState ?? {}) as Record<string, unknown>,
            ).map(([key, value]) => (
              <JsonNode key={key} name={key} value={value} />
            ))}
          </div>
        </div>
        {effectiveStatuses && Object.keys(effectiveStatuses).length > 0 && (
          <div className={style.state}>
            <div className={style.inner}>
              <header data-l10n-id="renderer-info-sources-section" />
              <ul className={style.innercontent}>
                {(
                  Object.entries(effectiveStatuses) as [
                    string,
                    DataSourceStatus,
                  ][]
                ).map(([key, status]) => (
                  <SourceRow
                    key={key}
                    sourceKey={key}
                    status={status}
                    cachedAt={
                      sourceCachedAt?.[key as keyof DataSourceTimestamps]
                    }
                    onInvalidate={
                      key === "weather" ||
                      key === "discovery" ||
                      key === "sponsored"
                        ? handleInvalidate
                        : undefined
                    }
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className={style.bridges}>
          <header data-l10n-id="renderer-info-bridges-section" />
          <div className={style.bridgeGroups}>
            <div className={style.bridgeGroup}>
              <h3 data-l10n-id="renderer-info-bridges-reporting" />
              <div>
                <button
                  onClick={handleReportError}
                  disabled={!bridges?.reportError}>
                  reportError
                </button>
                <button
                  onClick={handleReportMetric}
                  disabled={!bridges?.reportMetric}>
                  reportMetric
                </button>
              </div>
            </div>
            <div className={style.bridgeGroup}>
              <h3 data-l10n-id="renderer-info-bridges-content-actions" />
              <div>
                <button onClick={handleBlockUrl} disabled={!bridges?.blockUrl}>
                  blockUrl
                </button>
                <button
                  onClick={handleBookmarkUrl}
                  disabled={!bridges?.bookmarkUrl}>
                  bookmarkUrl
                </button>
                <button
                  onClick={handleDeleteBookmark}
                  disabled={!bridges?.deleteBookmark}>
                  deleteBookmark
                </button>
                <button
                  onClick={handleDeleteHistory}
                  disabled={!bridges?.deleteHistory}>
                  deleteHistory
                </button>
                <button onClick={handleOpenLink} disabled={!bridges?.openLink}>
                  openLink
                </button>
                <button
                  onClick={handleReportContent}
                  disabled={!bridges?.reportContent}>
                  reportContent
                </button>
                <button onClick={handlePinSite} disabled={!bridges?.pinSite}>
                  pinSite
                </button>
                <button
                  onClick={handleUnpinSite}
                  disabled={!bridges?.unpinSite}>
                  unpinSite
                </button>
                <button
                  onClick={handleSearchHandoff}
                  disabled={!bridges?.searchHandoff}>
                  searchHandoff
                </button>
              </div>
            </div>
            <div className={style.bridgeGroup}>
              <h3 data-l10n-id="renderer-info-bridges-messaging" />
              <div>
                <button
                  onClick={handleMessageImpressed}
                  disabled={!bridges?.messageImpressed}>
                  messageImpressed
                </button>
                <button
                  onClick={handleMessageDismissed}
                  disabled={!bridges?.messageDismissed}>
                  messageDismissed
                </button>
                <button
                  onClick={handleMessageCompleted}
                  disabled={!bridges?.messageCompleted}>
                  messageCompleted
                </button>
                <button
                  onClick={handleMessageBlocked}
                  disabled={!bridges?.messageBlocked}>
                  messageBlocked
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// --- Sub-components ---

type SourceRowProps = {
  sourceKey: string
  status: DataSourceStatus
  cachedAt?: string
  onInvalidate?: (key: "weather" | "discovery" | "sponsored") => Promise<void>
}

/**
 * Renders a single source row: status badge, key name, per-source TTL
 * countdown (for ready sources with a known cachedAt), and an invalidate button.
 */
function SourceRow({
  sourceKey,
  status,
  cachedAt,
  onInvalidate,
}: SourceRowProps) {
  const ttl = SOURCE_TTL_MS[sourceKey]
  const countdown = useCountdownSeconds(
    status === "ready" && cachedAt != null && ttl != null
      ? cachedAt
      : undefined,
    ttl ?? DATA_TTL_MS,
  )

  const showCountdown = status === "ready" && cachedAt != null && ttl != null

  return (
    <li>
      {STATUS_LABEL[status]} {sourceKey}
      {showCountdown && countdown != null && (
        <span> — next fetch in {formatDuration(countdown)}</span>
      )}
      {onInvalidate && (
        <button
          onClick={() =>
            onInvalidate(sourceKey as "weather" | "discovery" | "sponsored")
          }>
          invalidate
        </button>
      )}
    </li>
  )
}
