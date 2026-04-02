import style from "./style.module.css"

import { JsonNode } from "./json-tree"
import {
  DATA_STALE_MS,
  DATA_TTL_MS,
  formatDuration,
  useCountdownSeconds,
} from "./timers.hook"
import { useBridges } from "@data/state/coordinator-interface"

import type { AppProps } from "@common/types"

/**
 * RendererInfo
 * ---
 * POC debug panel showing renderer and data state.
 *
 * Displays manifest metadata, cache status, and countdown timers for TTL and
 * stale thresholds. Rendered by the coordinator as a self-contained diagnostic
 * surface during the discovery phase.
 */
export function RendererInfo(props: AppProps) {
  const {
    manifest,
    renderUpdate,
    nextHash,
    isCached,
    isStaleData,
    initialState,
    timeToStaleData,
  } = props
  const { dataSchemaVersion, buildTime, hash } = manifest

  const ttlSeconds = useCountdownSeconds(timeToStaleData, DATA_TTL_MS)
  const ttsSeconds = useCountdownSeconds(timeToStaleData, DATA_STALE_MS)
  const bridges = useBridges()

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
              <li
                data-l10n-id="renderer-info-time-to-ttl"
                data-l10n-args={JSON.stringify({
                  duration: formatDuration(ttlSeconds),
                })}
              />
              <li
                data-l10n-id="renderer-info-time-to-stale"
                data-l10n-args={JSON.stringify({
                  duration: formatDuration(ttsSeconds),
                })}
              />
            </ul>
          </div>
        </div>
        <div
          className={`${style.state} ${isStaleData ? style.willUpdate : ""}`}>
          <div className={style.inner}>
            <header
              data-l10n-id="renderer-info-data-section"
              data-l10n-args={JSON.stringify({ updating: String(isStaleData) })}
            />
            <div className={style.innercontent}></div>
            {Object.entries(initialState as Record<string, unknown>).map(
              ([key, value]) => (
                <JsonNode key={key} name={key} value={value} />
              ),
            )}
          </div>
        </div>
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
