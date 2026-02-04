import style from "./style.module.css"

import { inCenter } from "../_base/decorators"
import { useMenuOverflow, MenuOverflowPosition } from "./"

import type { Meta, StoryObj } from "@storybook/react-vite"
import type { UseMenuOverflowOptions } from "./"

type StoryArgs = {
  extraItems: number
  showOutline: boolean
  showBackgroundContent: boolean
} & UseMenuOverflowOptions

const POSITIONS = Object.values(MenuOverflowPosition) as MenuOverflowPosition[]

const meta: Meta<StoryArgs> = {
  title: "Menu / Overflow",
  parameters: {
    layout: "centered",
  },
  args: {
    position: MenuOverflowPosition.TOP_RIGHT,
    closeOnOutsideClick: true,
    closeOnEscape: true,
    extraItems: 0,
    showOutline: true,
    showBackgroundContent: false,
  },
  argTypes: {
    position: {
      control: "radio",
      options: POSITIONS,
    },
    extraItems: {
      control: { type: "range", min: 0, max: 20, step: 1 },
    },
    showOutline: {
      control: "boolean",
      description: "Show dashed outline around root container",
    },
    showBackgroundContent: {
      control: "boolean",
      description: "Show background content to demonstrate z-index layering",
    },
    closeOnEscape: { table: { disable: true } },
    onClose: { table: { disable: true } },
    onOpen: { table: { disable: true } },
  },
}
export default meta

export const Overflow: StoryObj<StoryArgs> = {
  decorators: [inCenter],
  render: (args) => {
    const { extraItems, showOutline, showBackgroundContent, ...options } = args
    const menu = useMenuOverflow(options)

    return (
      <div style={{ position: "relative", padding: "40px" }}>
        {showBackgroundContent && (
          <>
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                width: "200px",
                height: "150px",
                backgroundColor: "#e3f2fd",
                border: "2px solid #2196f3",
                padding: "16px",
                zIndex: 1,
              }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
                Background Layer (z-index: 1)
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "12px", opacity: 0.7 }}>
                The menu panel should appear above this content
              </p>
            </div>
            <div
              style={{
                position: "absolute",
                top: "60px",
                left: "160px",
                width: "180px",
                height: "120px",
                backgroundColor: "#fff3e0",
                border: "2px solid #ff9800",
                padding: "16px",
                zIndex: 2,
              }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
                Layer 2 (z-index: 2)
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "12px", opacity: 0.7 }}>
                Panel should appear above this too
              </p>
            </div>
          </>
        )}
        <div>
          <p>Outside Click Zone</p>
          <div
            ref={menu.rootRef}
            style={{
              position: "relative",
              border: showOutline ? "2px dashed hotpink" : "none",
              padding: "2rem",
              borderRadius: "8px",
              display: "inline-block",
            }}>
            <p>Inside Click Zone</p>
            <div
              style={{
                position: "absolute",
                bottom: "0.25rem",
                right: "0.25rem",
              }}>
              <menu.Trigger ariaLabel="Overflow menu" />
              <menu.Panel>
                <button
                  type="button"
                  className={style.item}
                  role="menuitem"
                  onClick={() => console.log("Clicked: stays open")}>
                  <span className={style.label}>Stays open</span>
                  <span className={style.meta}>⌘</span>
                </button>

                <button
                  type="button"
                  className={style.item}
                  role="menuitem"
                  onClick={menu.withClose(() =>
                    console.log("Clicked: closes"),
                  )}>
                  <span className={style.label}>Closes on click</span>
                  <span className={style.meta}>↩</span>
                </button>

                {extraItems > 0 ? (
                  <>
                    <div className={style.divider} />
                    {Array.from({ length: extraItems }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={style.item}
                        role="menuitem"
                        onClick={
                          i % 3 === 0
                            ? menu.withClose(() =>
                                console.log(`Closed item ${i + 1}`),
                              )
                            : () => console.log(`Open item ${i + 1}`)
                        }>
                        <span className={style.label}>Item {i + 1}</span>
                        <span className={style.meta}>
                          {i % 3 === 0 ? "×" : "•"}
                        </span>
                      </button>
                    ))}
                  </>
                ) : null}

                <div className={style.divider} />

                <button
                  type="button"
                  className={style.item}
                  role="menuitem"
                  onClick={menu.close}>
                  <span className={style.label}>Close</span>
                  <span className={style.meta}>Esc</span>
                </button>
              </menu.Panel>
            </div>
          </div>
        </div>
      </div>
    )
  },
}
