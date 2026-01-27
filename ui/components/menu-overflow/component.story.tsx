import style from "./style.module.css"

import { inCenter } from "../_base/decorators"
import { MenuOverflow as Component, MenuOverflowPosition } from "./"

import type { Meta, StoryObj } from "@storybook/react-vite"

type ComponentPropsAndCustomArgs = {
  extraItems: number
} & React.ComponentProps<typeof Component>

const POSITIONS = Object.values(MenuOverflowPosition) as MenuOverflowPosition[]

const meta: Meta<ComponentPropsAndCustomArgs> = {
  title: "Menu / Overflow",
  component: Component,
  parameters: {
    layout: "centered",
  },
  args: {
    ariaLabel: "Overflow menu",
    position: MenuOverflowPosition.TOP_RIGHT,
    closeOnOutsideClick: true,
    closeOnEscape: true,
    extraItems: 0,
  },
  argTypes: {
    position: {
      control: "radio",
      options: POSITIONS,
    },
    extraItems: {
      control: { type: "range", min: 0, max: 20, step: 1 },
    },
    closeOnEscape: { table: { disable: true } },
    onClose: { table: { disable: true } },
    onOpen: { table: { disable: true } },
    children: { table: { disable: true } },
  },
}
export default meta

export const Overflow: StoryObj<ComponentPropsAndCustomArgs> = {
  decorators: [inCenter],
  render: (args) => (
    <div>
      <Component {...args}>
        {({ close, withClose }) => (
          <>
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

            {args.extraItems > 0 ? (
              <>
                <div className={style.divider} />
                {Array.from({ length: args.extraItems }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={style.item}
                    role="menuitem"
                    onClick={
                      i % 3 === 0
                        ? withClose(() => console.log(`Closed item ${i + 1}`))
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
              onClick={close}>
              <span className={style.label}>Close</span>
              <span className={style.meta}>Esc</span>
            </button>
          </>
        )}
      </Component>
    </div>
  ),
}
