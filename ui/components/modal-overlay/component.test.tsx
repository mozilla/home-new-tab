import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useModal } from "."

import type { UseModalOptions, UseModalReturn } from "."

// jsdom does not implement showModal/close for <dialog>; mock them so the hook
// can call them without throwing, and so showModal sets the open attribute
// (required for the dialog to appear in the accessibility tree).
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "")
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open")
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function TestModal({
  children,
  ...options
}: UseModalOptions & {
  children: (api: UseModalReturn) => React.ReactNode
}) {
  const modal = useModal(options)
  return <>{children(modal)}</>
}

describe("useModal", () => {
  it("renders closed by default", () => {
    const { queryByRole } = render(
      <TestModal>
        {({ Modal }) => (
          <Modal>
            <p>Content</p>
          </Modal>
        )}
      </TestModal>,
    )

    expect(queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens the modal when open() is called", () => {
    const { queryByRole, getByText } = render(
      <TestModal>
        {({ open, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <p>Dialog content</p>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    expect(queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(getByText("Open"))
    expect(queryByRole("dialog")).toBeInTheDocument()
  })

  it("closes the modal when close() is called", () => {
    const { queryByRole, getByText } = render(
      <TestModal>
        {({ open, close, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <button onClick={close}>Close</button>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    fireEvent.click(getByText("Open"))
    expect(queryByRole("dialog")).toBeInTheDocument()

    fireEvent.click(getByText("Close"))
    expect(queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes on Escape via the cancel event", () => {
    const { queryByRole, getByText, getByRole } = render(
      <TestModal>
        {({ open, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <p>Content</p>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    fireEvent.click(getByText("Open"))
    const dialog = getByRole("dialog")

    fireEvent(dialog, new Event("cancel", { cancelable: true }))
    expect(queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes on backdrop click (click target is the dialog element)", () => {
    const { queryByRole, getByText, getByRole } = render(
      <TestModal>
        {({ open, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <p>Content</p>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    fireEvent.click(getByText("Open"))
    fireEvent.click(getByRole("dialog"))
    expect(queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("does not close when clicking inside the dialog content", () => {
    const { queryByRole, getByText, getByRole } = render(
      <TestModal>
        {({ open, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <p>Inner content</p>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    fireEvent.click(getByText("Open"))
    expect(queryByRole("dialog")).toBeInTheDocument()

    const inner = getByRole("dialog").querySelector("p")!
    fireEvent.click(inner)
    expect(queryByRole("dialog")).toBeInTheDocument()
  })

  it("withClose executes the action and closes the modal", () => {
    let actionExecuted = false

    const { queryByRole, getByText } = render(
      <TestModal>
        {({ open, withClose, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <button
                onClick={withClose(() => {
                  actionExecuted = true
                })}>
                Confirm
              </button>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    fireEvent.click(getByText("Open"))
    fireEvent.click(getByText("Confirm"))

    expect(actionExecuted).toBe(true)
    expect(queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("toggle switches between open and closed", () => {
    const { queryByRole, getByText } = render(
      <TestModal>
        {({ toggle, Modal }) => (
          <>
            <button onClick={toggle}>Toggle</button>
            <Modal>
              <p>Content</p>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    expect(queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(getByText("Toggle"))
    expect(queryByRole("dialog")).toBeInTheDocument()
    fireEvent.click(getByText("Toggle"))
    expect(queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("operates in controlled mode", () => {
    const onOpenChange = vi.fn()

    const { queryByRole, getByText, rerender } = render(
      <TestModal isOpen={false} onOpenChange={onOpenChange}>
        {({ open, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <p>Content</p>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    expect(queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(getByText("Open"))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    // Internal state is not updated — re-render must come from the outside
    expect(queryByRole("dialog")).not.toBeInTheDocument()

    rerender(
      <TestModal isOpen={true} onOpenChange={onOpenChange}>
        {({ open, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <p>Content</p>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    expect(queryByRole("dialog")).toBeInTheDocument()
  })

  it("restores focus to the element that was active when open() was called", () => {
    const { getByText, queryByRole } = render(
      <TestModal>
        {({ open, close, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <button onClick={close}>Close</button>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    const trigger = getByText("Open")
    trigger.focus()
    fireEvent.click(trigger)

    expect(queryByRole("dialog")).toBeInTheDocument()

    fireEvent.click(getByText("Close"))

    expect(queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })

  it("traps Tab at the last focusable element, wrapping to the first", () => {
    const { getByText, getByRole } = render(
      <TestModal>
        {({ open, close, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <button onClick={close}>Cancel</button>
              <button>Confirm</button>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    fireEvent.click(getByText("Open"))
    const dialog = getByRole("dialog")
    const confirmBtn = getByText("Confirm")
    const cancelBtn = getByText("Cancel")

    confirmBtn.focus()
    fireEvent.keyDown(dialog, { key: "Tab" })
    expect(document.activeElement).toBe(cancelBtn)
  })

  it("traps Shift+Tab at the first focusable element, wrapping to the last", () => {
    const { getByText, getByRole } = render(
      <TestModal>
        {({ open, close, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <button onClick={close}>Cancel</button>
              <button>Confirm</button>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    fireEvent.click(getByText("Open"))
    const dialog = getByRole("dialog")
    const confirmBtn = getByText("Confirm")
    const cancelBtn = getByText("Cancel")

    cancelBtn.focus()
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(confirmBtn)
  })

  it("calls onOpen and onClose callbacks", () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()

    const { getByText } = render(
      <TestModal onOpen={onOpen} onClose={onClose}>
        {({ open, close, Modal }) => (
          <>
            <button onClick={open}>Open</button>
            <Modal>
              <button onClick={close}>Close</button>
            </Modal>
          </>
        )}
      </TestModal>,
    )

    fireEvent.click(getByText("Open"))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(getByText("Close"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
