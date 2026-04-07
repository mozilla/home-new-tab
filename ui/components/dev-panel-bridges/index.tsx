import style from "./style.module.css"

import { useBridges } from "@data/state/coordinator-interface"

/**
 * DevPanelBridges
 * ---
 * Bridge invocation panel for the dev debug surface. Renders test buttons for
 * all host-provided bridge functions grouped by category. Buttons are disabled
 * when the corresponding bridge is not available.
 */
export function DevPanelBridges() {
  const bridges = useBridges()

  const handleReportError = () =>
    bridges?.reportError?.({
      source: "renderer",
      context: "dev-panel",
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
    <div className={style.base} data-testid="dev-panel-bridges">
      <header data-l10n-id="dev-panel-bridges-section" />
      <div className={style.bridgeGroups}>
        <div className={style.bridgeGroup}>
          <h3 data-l10n-id="dev-panel-bridges-reporting" />
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
          <h3 data-l10n-id="dev-panel-bridges-content-actions" />
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
            <button onClick={handleUnpinSite} disabled={!bridges?.unpinSite}>
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
          <h3 data-l10n-id="dev-panel-bridges-messaging" />
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
  )
}
