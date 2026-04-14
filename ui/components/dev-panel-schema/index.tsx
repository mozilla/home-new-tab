import style from "./style.module.css"

import { formatMs } from "@common/utilities/time"

type DevPanelSchemaProps = {
  dataSchema: unknown[]
}

/**
 * DevPanelSchema
 * ---
 * Renders the renderer's data-schema.json as a fixed-column grid in the dev
 * debug panel. One row per source descriptor with color-coded transport badge
 * and key fields shown inline: key(s), transport, endpoint/collection, cache TTL.
 */
export function DevPanelSchema({ dataSchema }: DevPanelSchemaProps) {
  return (
    <div className={style.base} data-testid="dev-panel-schema">
      <header data-l10n-id="dev-panel-schema-section" />
      <div className={style.content}>
        <div className={`${style.row} ${style.header}`}>
          <span data-l10n-id="dev-panel-schema-col-key" />
          <span data-l10n-id="dev-panel-schema-col-transport" />
          <span data-l10n-id="dev-panel-schema-col-detail" />
          <span data-l10n-id="dev-panel-schema-col-cache" />
          <span data-l10n-id="dev-panel-schema-col-blocking" />
        </div>
        {dataSchema.map((descriptor, i) => (
          <SchemaRow key={i} descriptor={descriptor} />
        ))}
      </div>
    </div>
  )
}

type SchemaRowProps = { descriptor: unknown }

function SchemaRow({ descriptor }: SchemaRowProps) {
  const d = descriptor as Record<string, unknown>
  const keys = Array.isArray(d.keys)
    ? (d.keys as string[]).join(", ")
    : String(d.key ?? "?")
  const transport = String(d.transport ?? "")
  const method = typeof d.method === "string" ? d.method : null
  const endpoint = typeof d.endpoint === "string" ? d.endpoint : null
  const collection = typeof d.collection === "string" ? d.collection : null
  const detail = endpoint
    ? [method, endpoint].filter(Boolean).join(" ")
    : (collection ?? "")
  const cache = [
    typeof d.ttlMs === "number" ? `${formatMs(d.ttlMs)} TTL` : null,
    typeof d.maxAgeMs === "number" ? `${formatMs(d.maxAgeMs)} max` : null,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <div className={style.row}>
      <span className={style.key}>{keys}</span>
      <span className={`${style.transport} ${style[transport] ?? ""}`}>
        {transport}
      </span>
      <span className={style.detail}>{detail}</span>
      <span className={style.meta}>{cache}</span>
      <span className={style.blocking}>
        {d.blocking === true ? "blocking" : "non-blocking"}
      </span>
    </div>
  )
}
