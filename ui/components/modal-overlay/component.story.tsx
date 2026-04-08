import { inCenter } from "../_base/decorators"
import { useModal } from "./"

import type { Meta, StoryObj } from "@storybook/react-vite"
import type { UseModalOptions } from "./"

type StoryArgs = UseModalOptions

const meta: Meta<StoryArgs> = {
  title: "Overlay / Modal",
  parameters: {
    layout: "centered",
  },
  args: {},
  argTypes: {
    onOpen: { table: { disable: true } },
    onClose: { table: { disable: true } },
    onOpenChange: { table: { disable: true } },
  },
}
export default meta

export const Modal: StoryObj<StoryArgs> = {
  decorators: [inCenter],
  render: (args) => {
    const modal = useModal(args)

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-large)",
          padding: "var(--space-xxlarge)",
          position: "relative",
        }}>
        {/* Background content — visible through the backdrop when the modal is open */}
        <div
          aria-hidden="true"
          style={{
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-medium)",
            opacity: 1,
            pointerEvents: "none",
            userSelect: "none",
            width: 400,
          }}>
          <div
            style={{
              backgroundColor: "var(--color-blue-0)",
              border: "1px solid var(--color-blue-40)",
              borderRadius: 6,
              height: 64,
              padding: "var(--space-large)",
            }}>
            <p
              style={{
                color: "var(--color-gray-70)",
                fontSize: "var(--font-size-small)",
                margin: 0,
              }}>
              Page content
            </p>
          </div>
          <div
            style={{
              backgroundColor: "var(--color-orange-0)",
              border: "1px solid var(--color-orange-30)",
              borderRadius: 6,
              height: 48,
              padding: "var(--space-large)",
            }}>
            <p
              style={{
                color: "var(--color-gray-70)",
                fontSize: "var(--font-size-small)",
                margin: 0,
              }}>
              More content
            </p>
          </div>
          <div
            style={{
              backgroundColor: "var(--color-blue-0)",
              border: "1px solid var(--color-blue-40)",
              borderRadius: 6,
              height: 64,
              padding: "var(--space-large)",
            }}>
            <p
              style={{
                color: "var(--color-gray-70)",
                fontSize: "var(--font-size-small)",
                margin: 0,
              }}>
              Even more content
            </p>
          </div>
        </div>

        <button
          type="button"
          style={{ alignSelf: "flex-start" }}
          onClick={modal.open}>
          Open modal
        </button>

        <modal.Modal>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              minWidth: "320px",
              padding: "24px",
            }}>
            <h2 style={{ margin: 0, fontSize: "1.125rem" }}>Confirm action</h2>
            <p style={{ margin: 0 }}>Are you sure you want to proceed?</p>
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}>
              <button type="button" onClick={modal.close}>
                Cancel
              </button>
              <button
                type="button"
                onClick={modal.withClose(() => console.log("confirmed"))}>
                Confirm
              </button>
            </div>
          </div>
        </modal.Modal>
      </div>
    )
  },
}
