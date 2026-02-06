import type { Decorator } from "@storybook/react-vite"

/**
 * inGrid
 * ---
 * Places the story in a default 12-column grid
 */
export const inGrid: Decorator = (Story) => {
  const gridStyle = {
    display: "grid",
    gap: "var(--space-large)",
    gridTemplateColumns: "repeat(12, 1fr)",
  }

  return (
    <section className="section-container">
      <div style={gridStyle}>
        <div style={{ gridColumnEnd: "span 4" }}>
          <Story />
        </div>
      </div>
    </section>
  )
}

/**
 * inContainer
 * ---
 * Places the story in a grid with passed in grid columns
 */
export const inContainer: Decorator = (Story, { args }) => {
  return (
    <div style={{ width: `${args.containerSize}%` }}>
      <Story />
    </div>
  )
}

/**
 * inCenter
 * ---
 * Places the story in the center of the page
 */
export const inCenter: Decorator = (Story) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: "100vh",
      }}>
      <div style={{ display: "block" }}>
        <Story />
      </div>
    </div>
  )
}

/**
 * inCardRig
 * ---
 * Allows for us to surface card in specific slots that can effect it's form
 */

export type CardRigSlot = "hero" | "medium" | "smallTop" | "smallBottom"

function Placeholder({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: "100%",
        borderRadius: 12,
        background: "rgba(120, 120, 120, 0.25)",
        border: "1px dashed rgba(120, 120, 120, 0.5)",
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        userSelect: "none",
      }}>
      {label}
    </div>
  )
}

/**
 * inCardRig
 * ---
 * Renders a simple, fixed grid used to visualize a single card
 * in hero / medium / small contexts without relying on feed layouts.
 *
 * Grid shape:
 *   H
 *   M | S
 *     | S
 *
 * The story is rendered once and placed into the slot defined
 * by `args.slot`.
 */
export const inCardRig: Decorator = (Story, ctx) => {
  const slot = (ctx.args?.slot ?? "hero") as CardRigSlot

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          width: "720px",
          maxWidth: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gridAutoRows: "minmax(120px, auto)",
          gap: 12,
        }}>
        {/* HERO */}
        <div style={{ gridColumn: "1 / -1", minHeight: "300px" }}>
          {slot === "hero" ? <Story /> : <Placeholder label="H" />}
        </div>

        {/* MEDIUM */}
        <div style={{ gridColumn: "1 / 6", gridRowEnd: "span 2" }}>
          {slot === "medium" ? <Story /> : <Placeholder label="M" />}
        </div>

        {/* SMALL STACK */}
        <div style={{ gridColumn: "6 / -1" }}>
          {slot === "smallTop" ? <Story /> : <Placeholder label="S (top)" />}
        </div>
        <div style={{ gridColumn: "6 / -1" }}>
          {slot === "smallBottom" ? (
            <Story />
          ) : (
            <Placeholder label="S (bottom)" />
          )}
        </div>
      </div>
    </div>
  )
}
