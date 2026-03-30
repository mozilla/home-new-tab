import style from "./style.module.css"

import {
  DATA_STALE_MS,
  DATA_TTL_MS,
  formatDuration,
  useCountdownSeconds,
} from "./timers.hook"

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
            <ul>
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
            <pre>
              <code typeof="json">{JSON.stringify(initialState, null, 2)}</code>
            </pre>
          </div>
        </div>
      </div>
    </main>
  )
}
