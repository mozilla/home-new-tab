import style from "./style.module.css"

import { useEffect, useState } from "react"
import { useBridges } from "@data/state/coordinator-interface"

/**
 * DevPanelBridges
 * ---
 * Adapter invocation panel for the dev debug surface. Renders test buttons for
 * the host-provided adapter methods grouped by adapter (telemetry, browserCore,
 * storage). Buttons are disabled when the adapter is not available. A "last
 * called" indicator confirms that each invocation fired through to the adapter.
 */
export function DevPanelBridges() {
  const bridges = useBridges()
  const [lastCalled, setLastCalled] = useState<string | null>(null)

  useEffect(() => {
    if (!lastCalled) return
    const t = setTimeout(() => setLastCalled(null), 1500)
    return () => clearTimeout(t)
  }, [lastCalled])

  function invoke(label: string, fn: () => void) {
    fn()
    setLastCalled(label)
  }

  const handleReportError = () =>
    invoke("reportError", () =>
      bridges?.telemetry.reportError({
        source: "renderer",
        context: "dev-panel",
        reason: "test error",
        severity: "warning",
      }),
    )

  const handleReportMetric = () =>
    invoke("reportMetric", () =>
      bridges?.telemetry.reportMetric({
        source: "renderer",
        name: "test-metric",
        value: 1,
        unit: "count",
      }),
    )

  const handleOpenLink = () =>
    invoke("openLink", () =>
      bridges?.browserCore.openLink("https://example.com", "new-tab"),
    )
  const handleBookmarkUrl = () =>
    invoke("bookmarkUrl", () =>
      bridges?.browserCore.bookmarkUrl("https://example.com", "Example"),
    )
  const handleDeleteBookmark = () =>
    invoke("deleteBookmark", () =>
      bridges?.browserCore.deleteBookmark("bookmark-1"),
    )
  const handleDeleteHistory = () =>
    invoke("deleteHistory", () =>
      bridges?.browserCore.deleteHistory("https://example.com"),
    )
  const handleHandoffSearch = () =>
    invoke("handoffSearch", () =>
      bridges?.browserCore.handoffSearch("test query"),
    )
  const handleReportContent = () =>
    invoke("reportContent", () =>
      bridges?.browserCore.reportContent("https://example.com"),
    )
  const handleDeleteUserData = () =>
    invoke("deleteUserData", () => bridges?.browserCore.deleteUserData())

  const handleStorageWrite = () =>
    invoke("storage.write", () =>
      bridges?.storage.write("dev.test", new Date().toISOString()),
    )
  const handleStorageRead = () => {
    const val = bridges?.storage.read("dev.test") ?? null
    console.log("[bridges] storage.read dev.test →", val)
    const label =
      val !== null ? `storage.read → "${val}"` : "storage.read → null"
    invoke(label, () => {})
  }
  const handleStorageDelete = () =>
    invoke("storage.delete", () => bridges?.storage.delete("dev.test"))

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
        <div className={style.bridgeGroup}>
          <h3 data-l10n-id="dev-panel-bridges-storage" />
          <div>
            <button onClick={handleStorageWrite} disabled={!bridges?.storage}>
              write
            </button>
            <button onClick={handleStorageRead} disabled={!bridges?.storage}>
              read
            </button>
            <button onClick={handleStorageDelete} disabled={!bridges?.storage}>
              delete
            </button>
          </div>
        </div>
      </div>
      {lastCalled && <div className={style.feedback}>↑ {lastCalled}</div>}
    </div>
  )
}
