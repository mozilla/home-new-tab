import style from "./style.module.css"

import { useRef, useState } from "react"
import { JsonNode } from "../dev-panel-tree"
import {
  SOURCE_TTL_MS,
  SOURCE_MAX_AGE_MS,
  formatDuration,
  useCountdownSeconds,
  useElapsedSeconds,
} from "./timers.hook"

import type {
  DataSourceStatus,
  DataSourceStatuses,
  DataSourceTimestamps,
} from "@common/types"

declare global {
  interface Window {
    hntClearSource?: (
      key: "weather" | "discovery" | "sponsored",
    ) => Promise<void>
    hntExpireSource?: (
      key: "weather" | "discovery" | "sponsored",
    ) => Promise<void>
  }
}

const STATUS_LABEL: Record<DataSourceStatus, string> = {
  pending: "⧖",
  stale: "↻",
  ready: "✓",
  failed: "✗",
}

const STATUS_CLASS: Record<DataSourceStatus, string> = {
  pending: style.statusPending,
  stale: style.statusStale,
  ready: style.statusReady,
  failed: style.statusFailed,
}

type DevPanelSourcesProps = {
  sourceStatuses: DataSourceStatuses
  sourceCachedAt?: DataSourceTimestamps
  initialState?: unknown
}

/**
 * DevPanelSources
 * ---
 * Combined data source status and data view for the dev debug panel. Each
 * card shows the source's cache status, TTL countdown, and invalidation
 * controls, with the coordinated data rendered as a collapsed JSON tree below.
 *
 * Iterates over the union of source status keys and initial state keys, so
 * sources with no data and data keys with no source status both render cleanly.
 */
export function DevPanelSources({
  sourceStatuses,
  sourceCachedAt,
  initialState,
}: DevPanelSourcesProps) {
  const [localStatuses, setLocalStatuses] = useState<DataSourceStatuses>({})

  const effectiveStatuses: DataSourceStatuses = {
    ...sourceStatuses,
    ...localStatuses,
  }

  const handleSetStale = async (key: "weather" | "discovery" | "sponsored") => {
    await window.hntClearSource?.(key)
    setLocalStatuses((prev) => ({ ...prev, [key]: "stale" }))
  }

  const handleExpire = async (key: "weather" | "discovery" | "sponsored") => {
    await window.hntExpireSource?.(key)
    setLocalStatuses((prev) => ({ ...prev, [key]: "pending" }))
  }

  const initialStateData = (initialState ?? {}) as Record<string, unknown>
  const allKeys = [
    ...new Set([
      ...Object.keys(effectiveStatuses),
      ...Object.keys(initialStateData),
    ]),
  ]

  return (
    <div className={style.base} data-testid="dev-panel-sources">
      <header data-l10n-id="dev-panel-sources-section" />
      <div className={style.innercontent}>
        {allKeys.map((key) => (
          <SourceRow
            key={key}
            sourceKey={key}
            status={
              (
                effectiveStatuses as Record<
                  string,
                  DataSourceStatus | undefined
                >
              )[key]
            }
            cachedAt={sourceCachedAt?.[key as keyof DataSourceTimestamps]}
            onSetStale={
              key === "weather" || key === "discovery" || key === "sponsored"
                ? handleSetStale
                : undefined
            }
            onExpire={
              key === "weather" || key === "discovery" || key === "sponsored"
                ? handleExpire
                : undefined
            }
            data={initialStateData[key]}
          />
        ))}
      </div>
    </div>
  )
}

// --- Sub-components ---

type SourceRowProps = {
  sourceKey: string
  status?: DataSourceStatus
  cachedAt?: string
  onSetStale?: (key: "weather" | "discovery" | "sponsored") => Promise<void>
  onExpire?: (key: "weather" | "discovery" | "sponsored") => Promise<void>
  data?: unknown
}

/**
 * Renders a single source card: status badge, key name, TTL countdown, and
 * invalidation controls in the header row, with the coordinated data rendered
 * as a collapsed JSON tree below. Either section is omitted when absent.
 */
function SourceRow({
  sourceKey,
  status,
  cachedAt,
  onSetStale,
  onExpire,
  data,
}: SourceRowProps) {
  const ttl = SOURCE_TTL_MS[sourceKey]
  const maxAge = SOURCE_MAX_AGE_MS[sourceKey]
  const countdown = useCountdownSeconds(
    status === "ready" && cachedAt != null && ttl != null
      ? cachedAt
      : undefined,
    ttl,
  )
  const expiryCountdown = useCountdownSeconds(
    (status === "ready" || status === "stale") &&
      cachedAt != null &&
      maxAge != null
      ? cachedAt
      : undefined,
    maxAge,
  )

  const staleAtStr =
    status === "stale" && cachedAt != null && ttl != null
      ? new Date(Date.parse(cachedAt) + ttl).toISOString()
      : undefined
  const staleElapsed = useElapsedSeconds(staleAtStr)

  const cardRef = useRef<HTMLDivElement>(null)
  const [treeExpanded, setTreeExpanded] = useState(false)

  const toggleTree = () => {
    const next = !treeExpanded
    cardRef.current?.querySelectorAll("details").forEach((d) => {
      d.open = next
    })
    setTreeExpanded(next)
  }

  const dataEntries =
    data !== undefined && typeof data === "object" && data !== null
      ? Object.entries(data as Record<string, unknown>)
      : null

  return (
    <div ref={cardRef}>
      <div className={style.rowHeader}>
        <div>
          {status && (
            <span className={STATUS_CLASS[status]}>
              {STATUS_LABEL[status]}{" "}
            </span>
          )}
          {sourceKey}
        </div>
        <div>
          {status === "ready" && ttl != null && countdown != null && (
            <span className={style.countdown}>
              stale in {formatDuration(countdown)}
            </span>
          )}
          {status === "stale" && (
            <span className={style.countdown}>
              {staleElapsed != null
                ? `stale for ${formatDuration(staleElapsed)}`
                : "refreshing for next load"}
            </span>
          )}
          {(status === "ready" || status === "stale") &&
            maxAge != null &&
            expiryCountdown != null &&
            expiryCountdown > 0 && (
              <span className={style.countdown}>
                {" "}
                — expires in {formatDuration(expiryCountdown)}
              </span>
            )}
        </div>
        <div className={style.actions}>
          {onSetStale && (
            <button
              onClick={() =>
                onSetStale(sourceKey as "weather" | "discovery" | "sponsored")
              }>
              set stale
            </button>
          )}
          {onExpire && (
            <button
              onClick={() =>
                onExpire(sourceKey as "weather" | "discovery" | "sponsored")
              }>
              expire
            </button>
          )}
          {data !== undefined && (
            <button
              className={`${style.treeToggle}${treeExpanded ? ` ${style.treeToggleExpanded}` : ""}`}
              onClick={toggleTree}
              title={treeExpanded ? "Collapse all" : "Expand all"}>
              ▾
            </button>
          )}
        </div>
      </div>
      {data !== undefined && (
        <details className={style.rowData}>
          <summary className={style.treeSummary}>
            <span className={style.treeHint}>
              {dataEntries !== null
                ? `{${dataEntries.length}}`
                : Array.isArray(data)
                  ? `[${(data as unknown[]).length}]`
                  : String(data)}
            </span>
          </summary>
          <div className={style.treeChildren}>
            {dataEntries !== null ? (
              dataEntries.map(([k, v]) => (
                <JsonNode key={k} name={k} value={v} />
              ))
            ) : (
              <JsonNode name="value" value={data} />
            )}
          </div>
        </details>
      )}
    </div>
  )
}
