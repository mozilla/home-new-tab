import style from "./style.module.css"
import storyStyle from "./style.story.module.css"

import { inCenter } from "../_base/decorators"
import { useMenuOverflow, MenuOverflowPosition } from "./"

import type { Meta, StoryObj } from "@storybook/react-vite"
import type { UseMenuOverflowOptions } from "./"

type StoryArgs = {
  extraItems: number
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
    showBackgroundContent: true,
  },
  argTypes: {
    position: {
      control: "radio",
      options: POSITIONS,
    },
    extraItems: {
      control: { type: "range", min: 0, max: 20, step: 1 },
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
    const { extraItems, showBackgroundContent, ...options } = args
    const { Trigger, Panel, close, withClose, rootRef } =
      useMenuOverflow(options)

    return (
      <div className={storyStyle.storyContainer}>
        <div>
          {showBackgroundContent && (
            <div className={storyStyle.relativeWrapper}>
              <div className={storyStyle.backgroundOne}>
                <p className={storyStyle.layerTitle}>Background Layer</p>
                <p>(z-index: 1)</p>
                <p className={storyStyle.layerDescription}>
                  The menu panel should appear above this content
                </p>
              </div>

              <div className={storyStyle.backgroundTwo}>
                <p className={storyStyle.layerTitle}>Layer 2</p>
                <p>(z-index: 2)</p>
                <p className={storyStyle.layerDescription}>
                  Panel should appear above this too
                </p>
              </div>
            </div>
          )}
          <div ref={rootRef} className={storyStyle.rootContainerOutline}>
            <p>Inside Click Zone</p>
            <div className={storyStyle.triggerWrapper}>
              <Trigger ariaLabel="Overflow menu" />
              <Panel>
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
                  onClick={withClose(() => console.log("Clicked: closes"))}>
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
                            ? withClose(() =>
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

                <hr />

                <button
                  type="button"
                  className={style.item}
                  role="menuitem"
                  onClick={close}>
                  <span className={style.label}>Close</span>
                  <span className={style.meta}>Esc</span>
                </button>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    )
  },
}
