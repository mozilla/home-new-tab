import style from "./style.module.css"

import { DevPanelBridges } from "../dev-panel-bridges"
import { DevPanelMetrics } from "../dev-panel-metrics"
import { DevPanelSchema } from "../dev-panel-schema"
import { DevPanelSources } from "../dev-panel-sources"

import type { AppProps } from "@common/types"

/**
 * DevPanel
 * ---
 * POC debug panel showing renderer and data state. Composes the metrics,
 * bridges, and sources sub-panels into a single diagnostic surface.
 * Rendered by the coordinator during the discovery phase.
 */
export function DevPanel(props: AppProps) {
  const {
    manifest,
    renderUpdate,
    nextHash,
    isCached,
    initialState,
    sourceStatuses,
    sourceCachedAt,
    dataSchema,
  } = props

  const hasContent =
    (sourceStatuses != null && Object.keys(sourceStatuses).length > 0) ||
    (initialState != null &&
      typeof initialState === "object" &&
      Object.keys(initialState).length > 0)

  return (
    <main className={style.base} data-testid="dev-panel">
      <header className={style.title}>
        <div className={style.titleMain}>
          <h1 data-l10n-id="dev-panel-title" />
          <h2
            data-l10n-id="dev-panel-renderer-type"
            data-l10n-args={JSON.stringify({ cached: String(isCached) })}
          />
        </div>
        <aside className={style.note}>
          <p>FTL changes need a reload to appear.</p>
          <p className={style.noteDetail}>
            By design — mirrors the translation pipeline.
          </p>
        </aside>
      </header>
      <div className={style.content}>
        <DevPanelMetrics
          manifest={manifest}
          renderUpdate={renderUpdate}
          isCached={isCached}
          nextHash={nextHash}
        />
        <DevPanelBridges />
        {dataSchema && dataSchema.length > 0 && (
          <DevPanelSchema dataSchema={dataSchema} />
        )}
        {hasContent && (
          <DevPanelSources
            sourceStatuses={sourceStatuses ?? {}}
            sourceCachedAt={sourceCachedAt}
            initialState={initialState}
          />
        )}
      </div>
    </main>
  )
}
