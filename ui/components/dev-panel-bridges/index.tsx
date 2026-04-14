import style from "./style.module.css"

import { useBridges } from "@data/state/coordinator-interface"

/**
 * DevPanelBridges
 * ---
 * Adapter invocation panel for the dev debug surface. Renders test buttons for
 * the host-provided adapter methods grouped by adapter. Buttons are disabled
 * when the adapter is not available.
 */
export function DevPanelBridges() {
  const bridges = useBridges()

  const handleReportError = () =>
    bridges?.telemetry.reportError({
      source: "renderer",
      context: "dev-panel",
      reason: "test error",
      severity: "warning",
    })

  const handleReportMetric = () =>
    bridges?.telemetry.reportMetric({
      source: "renderer",
      name: "test-metric",
      value: 1,
      unit: "count",
    })

  const handleOpenLink = () =>
    bridges?.browserCore.openLink("https://example.com", "new-tab")
  const handleBookmarkUrl = () =>
    bridges?.browserCore.bookmarkUrl("https://example.com", "Example")
  const handleDeleteBookmark = () =>
    bridges?.browserCore.deleteBookmark("bookmark-1")
  const handleDeleteHistory = () =>
    bridges?.browserCore.deleteHistory("https://example.com")
  const handleHandoffSearch = () =>
    bridges?.browserCore.handoffSearch("test query")
  const handleReportContent = () =>
    bridges?.browserCore.reportContent("https://example.com")
  const handleDeleteUserData = () => bridges?.browserCore.deleteUserData()

  return (
    <div className={style.base} data-testid="dev-panel-bridges">
      <header data-l10n-id="dev-panel-bridges-section" />
      <div className={style.bridgeGroups}>
        <div className={style.bridgeGroup}>
          <h3 data-l10n-id="dev-panel-bridges-reporting" />
          <div>
            <button onClick={handleReportError} disabled={!bridges?.telemetry}>
              reportError
            </button>
            <button onClick={handleReportMetric} disabled={!bridges?.telemetry}>
              reportMetric
            </button>
          </div>
        </div>
        <div className={style.bridgeGroup}>
          <h3 data-l10n-id="dev-panel-bridges-content-actions" />
          <div>
            <button onClick={handleOpenLink} disabled={!bridges?.browserCore}>
              openLink
            </button>
            <button
              onClick={handleBookmarkUrl}
              disabled={!bridges?.browserCore}>
              bookmarkUrl
            </button>
            <button
              onClick={handleDeleteBookmark}
              disabled={!bridges?.browserCore}>
              deleteBookmark
            </button>
            <button
              onClick={handleDeleteHistory}
              disabled={!bridges?.browserCore}>
              deleteHistory
            </button>
            <button
              onClick={handleHandoffSearch}
              disabled={!bridges?.browserCore}>
              handoffSearch
            </button>
            <button
              onClick={handleReportContent}
              disabled={!bridges?.browserCore}>
              reportContent
            </button>
            <button
              onClick={handleDeleteUserData}
              disabled={!bridges?.browserCore}>
              deleteUserData
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
