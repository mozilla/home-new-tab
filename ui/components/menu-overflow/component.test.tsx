import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { useMenuOverflow } from "."

import type { UseMenuOverflowOptions, MenuOverflowHookReturn } from "."

function TestMenu({
  testid,
  children,
  ...options
}: UseMenuOverflowOptions & {
  testid?: string
  children: (api: MenuOverflowHookReturn) => React.ReactNode
}) {
  const menu = useMenuOverflow(options)
  return (
    <div ref={menu.rootRef} data-testid={testid}>
      {children(menu)}
    </div>
  )
}

describe("useMenuOverflow", () => {
  afterEach(() => {
    cleanup()
  })
  it("renders closed with defaults", () => {
    const rendered = render(
      <TestMenu testid="menu-overflow-1">
        {({ Trigger, Panel }) => (
          <>
            <Trigger />
            <Panel>
              <div />
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    expect(rendered.getByTestId("menu-overflow-1")).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })

  it("opens the panel on trigger click", () => {
    const rendered = render(
      <TestMenu testid="menu-overflow-2">
        {({ Trigger, Panel }) => (
          <>
            <Trigger />
            <Panel>
              <div>Item</div>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-2")
    const trigger = within(menuRoot).getByRole("button")

    fireEvent.click(trigger)

    expect(rendered.getByRole("menu")).toBeInTheDocument()
    expect(rendered.getByText("Item")).toBeInTheDocument()
  })

  it("renders panel with content when open", () => {
    const rendered = render(
      <TestMenu testid="menu-overflow-3">
        {({ Trigger, Panel }) => (
          <>
            <Trigger ariaLabel="Test menu" />
            <Panel>
              <button role="menuitem">Action 1</button>
              <button role="menuitem">Action 2</button>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const trigger = rendered.getByRole("button", { name: "Test menu" })
    fireEvent.click(trigger)

    const menuItems = rendered.getAllByRole("menuitem")
    expect(menuItems).toHaveLength(2)
    expect(menuItems[0]).toHaveTextContent("Action 1")
    expect(menuItems[1]).toHaveTextContent("Action 2")
  })

  it("closes the menu when close is called", () => {
    const rendered = render(
      <TestMenu testid="menu-overflow-4">
        {({ Trigger, Panel, close }) => (
          <>
            <Trigger />
            <Panel>
              <button onClick={close}>Close Me</button>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-4")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    expect(rendered.getByRole("menu")).toBeInTheDocument()

    const closeButton = rendered.getByText("Close Me")
    fireEvent.click(closeButton)

    expect(rendered.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("withClose executes action and closes menu", () => {
    let actionExecuted = false
    const mockAction = () => {
      actionExecuted = true
    }

    const rendered = render(
      <TestMenu testid="menu-overflow-5">
        {({ Trigger, Panel, withClose }) => (
          <>
            <Trigger />
            <Panel>
              <button onClick={withClose(mockAction)}>Action</button>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-5")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    const actionButton = rendered.getByText("Action")
    fireEvent.click(actionButton)

    expect(actionExecuted).toBe(true)
    expect(rendered.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("operates in controlled mode", () => {
    let controlledIsOpen = false
    const mockOpenChange = (isOpen: boolean) => {
      controlledIsOpen = isOpen
    }

    const rendered = render(
      <TestMenu
        testid="menu-overflow-6"
        isOpen={controlledIsOpen}
        onOpenChange={mockOpenChange}>
        {({ Trigger, Panel }) => (
          <>
            <Trigger />
            <Panel>
              <div>Item</div>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    expect(controlledIsOpen).toBe(false)

    // Trigger should call onOpenChange, not directly change internal state
    const menuRoot = rendered.getByTestId("menu-overflow-6")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    expect(controlledIsOpen).toBe(true)

    // Rerender with updated controlled state
    rendered.rerender(
      <TestMenu
        testid="menu-overflow-6"
        isOpen={true}
        onOpenChange={mockOpenChange}>
        {({ Trigger, Panel }) => (
          <>
            <Trigger />
            <Panel>
              <div>Item</div>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    expect(rendered.getByRole("menu")).toBeInTheDocument()
  })

  it("closes on Escape key press", () => {
    const rendered = render(
      <TestMenu testid="menu-overflow-7" closeOnEscape={true}>
        {({ Trigger, Panel }) => (
          <>
            <Trigger />
            <Panel>
              <div>Item</div>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-7")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    expect(rendered.getByRole("menu")).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })

    expect(rendered.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("does not close on Escape when closeOnEscape is false", () => {
    const rendered = render(
      <TestMenu testid="menu-overflow-8" closeOnEscape={false}>
        {({ Trigger, Panel }) => (
          <>
            <Trigger />
            <Panel>
              <div>Item</div>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-8")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    expect(rendered.getByRole("menu")).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })

    expect(rendered.getByRole("menu")).toBeInTheDocument()
  })

  it("closes on outside click", () => {
    const rendered = render(
      <div>
        <div data-testid="outside">Outside element</div>
        <TestMenu testid="menu-overflow-9" closeOnOutsideClick={true}>
          {({ Trigger, Panel }) => (
            <>
              <Trigger />
              <Panel>
                <div>Item</div>
              </Panel>
            </>
          )}
        </TestMenu>
      </div>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-9")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    expect(rendered.getByRole("menu")).toBeInTheDocument()

    const outsideElement = rendered.getByTestId("outside")
    fireEvent.pointerDown(outsideElement)

    expect(rendered.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("does not close on outside click when closeOnOutsideClick is false", () => {
    const rendered = render(
      <div>
        <div data-testid="outside">Outside element</div>
        <TestMenu testid="menu-overflow-10" closeOnOutsideClick={false}>
          {({ Trigger, Panel }) => (
            <>
              <Trigger />
              <Panel>
                <div>Item</div>
              </Panel>
            </>
          )}
        </TestMenu>
      </div>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-10")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    expect(rendered.getByRole("menu")).toBeInTheDocument()

    const outsideElement = rendered.getByTestId("outside")
    fireEvent.pointerDown(outsideElement)

    expect(rendered.getByRole("menu")).toBeInTheDocument()
  })

  it("renders custom trigger content", () => {
    const rendered = render(
      <TestMenu testid="menu-overflow-11">
        {({ Trigger, Panel }) => (
          <>
            <Trigger ariaLabel="Custom">
              <span>Custom Content</span>
            </Trigger>
            <Panel>
              <div>Item</div>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const trigger = rendered.getByRole("button", { name: "Custom" })
    expect(trigger).toHaveTextContent("Custom Content")

    // Should not have the default SVG icon
    expect(trigger.querySelector("svg")).not.toBeInTheDocument()
  })

  it("toggle function switches menu state", () => {
    const rendered = render(
      <TestMenu testid="menu-overflow-12">
        {({ Trigger, Panel, toggle }) => (
          <>
            <Trigger />
            <Panel>
              <button onClick={toggle}>Toggle</button>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-12")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    expect(rendered.getByRole("menu")).toBeInTheDocument()

    const toggleButton = rendered.getByText("Toggle")
    fireEvent.click(toggleButton)

    expect(rendered.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("calls onOpen and onClose callbacks", () => {
    let openCalled = false
    let closeCalled = false
    const handleOpen = () => {
      openCalled = true
    }
    const handleClose = () => {
      closeCalled = true
    }

    const rendered = render(
      <TestMenu
        testid="menu-overflow-13"
        onOpen={handleOpen}
        onClose={handleClose}>
        {({ Trigger, Panel, close }) => (
          <>
            <Trigger />
            <Panel>
              <button onClick={close}>Close</button>
            </Panel>
          </>
        )}
      </TestMenu>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-13")
    const trigger = within(menuRoot).getByRole("button")
    fireEvent.click(trigger)

    expect(openCalled).toBe(true)
    expect(closeCalled).toBe(false)

    const closeButton = rendered.getByText("Close")
    fireEvent.click(closeButton)

    expect(closeCalled).toBe(true)
  })
})
