import style from "./style.module.css"

type JsonNodeProps = { name: string; value: unknown }

// Maps JS primitive types to their CSS module color classes. Avoids a dynamic
// string-interpolated class lookup, which TypeScript can't verify.
const typeClass: Record<string, string | undefined> = {
  string: style.treeString,
  number: style.treeNumber,
  boolean: style.treeBoolean,
}

/**
 * JsonNode
 * ---
 * Recursive tree node for rendering unknown JSON-shaped values in the dev
 * debug panel. Objects and arrays render as collapsible `<details>` nodes
 * with a key + count hint in the summary. Primitives and null render inline
 * with type-based color coding.
 *
 * All nodes start collapsed. Designed for visual scanning — expand what you need
 */
export function JsonNode({ name, value }: JsonNodeProps) {
  if (value === null || value === undefined) {
    return (
      <div className={style.treeLeaf}>
        <span className={style.treeKey}>{name}:</span>{" "}
        <span className={style.treeNull}>null</span>
      </div>
    )
  }

  if (Array.isArray(value)) {
    return (
      <details className={style.treeNode}>
        <summary className={style.treeSummary}>
          <span className={style.treeKey}>{name}</span>
          <span className={style.treeHint}>[{value.length}]</span>
        </summary>
        <div className={style.treeChildren}>
          {value.map((item, i) => (
            <JsonNode key={i} name={String(i)} value={item} />
          ))}
        </div>
      </details>
    )
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as object)
    return (
      <details className={style.treeNode}>
        <summary className={style.treeSummary}>
          <span className={style.treeKey}>{name}</span>
          <span className={style.treeHint}>{`{${keys.length}}`}</span>
        </summary>
        <div className={style.treeChildren}>
          {keys.map((k) => (
            <JsonNode
              key={k}
              name={k}
              value={(value as Record<string, unknown>)[k]}
            />
          ))}
        </div>
      </details>
    )
  }

  return (
    <div className={style.treeLeaf}>
      <span className={style.treeKey}>{name}:</span>{" "}
      <span className={typeClass[typeof value]}>{String(value)}</span>
    </div>
  )
}
