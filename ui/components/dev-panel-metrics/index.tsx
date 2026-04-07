import style from "./style.module.css"

import type { AppProps } from "@common/types"

type DevPanelMetricsProps = Pick<
  AppProps,
  "manifest" | "renderUpdate" | "isCached" | "nextHash"
>

/**
 * DevPanelMetrics
 * ---
 * Renderer metadata card for the dev debug panel. Displays the current
 * renderer hash, build time, schema version, and cache source. Shows a purple
 * bottom border on the card header when a renderer update is pending.
 */
export function DevPanelMetrics({
  manifest,
  renderUpdate,
  isCached,
  nextHash,
}: DevPanelMetricsProps) {
  const { dataSchemaVersion, buildTime, hash } = manifest

  return (
    <div
      className={`${style.base} ${renderUpdate ? style.willUpdate : ""}`}
      data-testid="dev-panel-metrics">
      <div className={style.inner}>
        <header
          data-l10n-id="dev-panel-metrics-section"
          data-l10n-args={JSON.stringify({ updating: String(renderUpdate) })}
        />
        <ul className={style.innercontent}>
          <li
            data-l10n-id="dev-panel-metrics-source"
            data-l10n-args={JSON.stringify({ cached: String(isCached) })}
          />
          <li
            data-l10n-id="dev-panel-metrics-hash"
            data-l10n-args={JSON.stringify({ hash })}
          />
          {nextHash ? (
            <li
              data-l10n-id="dev-panel-metrics-next-hash"
              data-l10n-args={JSON.stringify({ hash: nextHash })}
            />
          ) : null}
          <li
            data-l10n-id="dev-panel-metrics-schema-version"
            data-l10n-args={JSON.stringify({ version: dataSchemaVersion })}
          />
          <li
            data-l10n-id="dev-panel-metrics-build-time"
            data-l10n-args={JSON.stringify({
              time: new Date(buildTime).toLocaleString(),
            })}
          />
        </ul>
      </div>
    </div>
  )
}
