import style from "./style.module.css"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { MenuOverflowPosition } from "./types"

import type { MouseEvent } from "react"
import type {
  UseMenuOverflowOptions,
  MenuOverflowHookReturn,
  MenuOverflowApi,
  MenuOverflowTrigger,
  MenuOverflowPanel,
  OpenPanelProps,
} from "./types"

export { MenuOverflowPosition }
export type { UseMenuOverflowOptions, MenuOverflowHookReturn, OpenPanelProps }

const POSITION_CLASS: Record<MenuOverflowPosition, string> = {
  [MenuOverflowPosition.TOP_LEFT]: style.panelFromTopLeft,
  [MenuOverflowPosition.TOP_RIGHT]: style.panelFromTopRight,
  [MenuOverflowPosition.BOTTOM_LEFT]: style.panelFromBottomLeft,
  [MenuOverflowPosition.BOTTOM_RIGHT]: style.panelFromBottomRight,
}

/**
 * useMenuOverflow
 * ---
 * Hook for managing overflow menu state and components.
 *
 * Returns Trigger and Panel components that can be rendered anywhere,
 * plus actions for controlling the menu programmatically.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const menu = useMenuOverflow({ position: MenuOverflowPosition.BOTTOM_RIGHT })
 *
 *   return (
 *     <div ref={menu.rootRef} onMouseLeave={menu.close}>
 *       <menu.Trigger />
 *       <menu.Panel>
 *         <button onClick={menu.withClose(() => alert("Action"))}>
 *           Action
 *         </button>
 *       </menu.Panel>
 *     </div>
 *   )
 * }
 * ```
 *
 * @param options - Configuration options
 * @returns Hook API with Trigger, Panel, and control functions
 */
export function useMenuOverflow<T extends HTMLElement = HTMLDivElement>(
  options: UseMenuOverflowOptions = {},
): MenuOverflowHookReturn<T> {
  const {
    position = MenuOverflowPosition.BOTTOM_RIGHT,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    onOpen,
    onClose,
    isOpen: controlledIsOpen,
    onOpenChange,
  } = options

  const uid = useId()

  // Avoiding collisions with multiple menus on the page
  const buttonId = useMemo(() => `menu-overflow-button-${uid}`, [uid])
  const panelId = useMemo(() => `menu-overflow-panel-${uid}`, [uid])

  // We expose this as the boundary of the clickable space without closing the menu
  const rootRef = useRef<T | null>(null)

  // Determine if we're in controlled mode
  const isControlled = controlledIsOpen !== undefined

  // Internal state (only used in uncontrolled mode)
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  // Use controlled value or internal state
  const isOpen = isControlled ? Boolean(controlledIsOpen) : internalIsOpen

  /**
   * Unified state setter that handles both controlled and uncontrolled modes.
   *
   * Notes:
   * - In controlled mode, we delegate to onOpenChange.
   * - In uncontrolled mode, we update internal state.
   * - Avoid duplicate lifecycle calls when setting the same value.
   */
  const setIsOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const nextValue = typeof value === "function" ? value(isOpen) : value
      if (nextValue === isOpen) return

      if (isControlled) onOpenChange?.(nextValue)
      else setInternalIsOpen(nextValue)

      if (nextValue) onOpen?.()
      else onClose?.()
    },
    [isControlled, isOpen, onOpenChange, onOpen, onClose],
  )

  /**
   * Close the menu. Stable identity so it can be safely used in callbacks.
   */
  const close = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  /**
   * Open the menu. Stable identity so it can be safely used in callbacks.
   */
  const open = useCallback(() => {
    setIsOpen(true)
  }, [setIsOpen])

  /**
   * Toggle open/close. Stable identity so it can be safely used in callbacks.
   */
  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [setIsOpen])

  /**
   * Wrap an action so it runs, then closes the menu.
   * Stable identity because it only depends on {@link close}.
   */
  const withClose: MenuOverflowApi["withClose"] = useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        fn(...args)
        close()
      },
    [close],
  )

  const positionClass = POSITION_CLASS[position]

  // Mutable ref so Trigger can read current values without changing its identity.
  // Updated synchronously during render — children read the latest values when they render.
  const triggerStateRef = useRef({ isOpen, toggle })
  triggerStateRef.current = { isOpen, toggle }

  /**
   * Trigger slot.
   *
   * Always a <button>, with optional children that replace the default icon.
   *
   * Identity is stable across open/close cycles (deps are only the stable IDs from useId).
   * Mutable state is read from {@link triggerStateRef} at render time.
   */
  const Trigger: MenuOverflowTrigger = useCallback(
    ({ ariaLabel = "Menu", children }) => {
      const { isOpen: currentIsOpen, toggle: currentToggle } =
        triggerStateRef.current
      const handleTriggerClick = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        currentToggle()
      }
      return (
        <button
          id={buttonId}
          type="button"
          className={style.overflow}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={currentIsOpen}
          aria-controls={panelId}
          onClick={handleTriggerClick}>
          {children ?? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7 11H5.5L5 11.5V13L5.5 13.5H7L7.5 13V11.5L7 11ZM12.75 11H11.25L10.75 11.5V13L11.25 13.5H12.75L13.25 13V11.5L12.75 11ZM17 11H18.5L19 11.5V13L18.5 13.5H17L16.5 13V11.5L17 11Z"
                fill="currentColor"
              />
            </svg>
          )}
        </button>
      )
    },
    [buttonId, panelId],
  )

  // Mutable ref so Panel can read current values without changing its identity.
  const panelStateRef = useRef({ isOpen, close })
  panelStateRef.current = { isOpen, close }

  /**
   * Panel slot.
   *
   * Only renders while open, and delegates global listeners + container rendering
   * to {@link OpenPanel}.
   *
   * Identity is stable across open/close cycles. Mutable state is read from
   * {@link panelStateRef} at render time; stable config values stay in the closure.
   */
  const Panel: MenuOverflowPanel = useCallback(
    ({ children: panelChildren }) => {
      const { isOpen: currentIsOpen, close: currentClose } =
        panelStateRef.current
      if (!currentIsOpen) return null

      return (
        <OpenPanel
          rootRef={rootRef}
          buttonId={buttonId}
          panelId={panelId}
          positionClass={positionClass}
          closeOnOutsideClick={closeOnOutsideClick}
          closeOnEscape={closeOnEscape}
          close={currentClose}>
          {panelChildren}
        </OpenPanel>
      )
    },
    [
      buttonId,
      panelId,
      positionClass,
      closeOnOutsideClick,
      closeOnEscape,
      rootRef,
    ],
  )
  return {
    isOpen,
    close,
    open,
    toggle,
    withClose,
    Trigger,
    Panel,
    rootRef,
  }
}

const MENU_ITEM_SELECTOR =
  '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'

/**
 * OpenPanel
 * ---
 * Mounted only while the menu is open.
 *
 * Responsibilities:
 * - Register global listeners (Escape + outside click)
 * - Arrow key navigation between menu items
 * - Focus first item on open; restore focus to trigger on close
 * - Render the positioned panel container
 *
 * Performance:
 * - This component is intentionally not rendered when closed, so closed menus are cheap
 *   even when many instances exist on the page.
 */
function OpenPanel<T extends HTMLElement = HTMLElement>({
  rootRef,
  buttonId,
  panelId,
  positionClass,
  closeOnOutsideClick,
  closeOnEscape,
  close,
  children,
}: OpenPanelProps<T>) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!closeOnEscape) return
      if (e.key === "Escape") close()
    }

    function onPointerDown(e: PointerEvent) {
      if (!closeOnOutsideClick) return

      const root = rootRef.current
      if (!root) return

      if (root.contains(e.target as Node)) return

      close()
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [closeOnEscape, closeOnOutsideClick, close, rootRef])

  // Focus first menu item on open; restore focus to trigger on close.
  useEffect(() => {
    const items =
      panelRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []
    items[0]?.focus()
    return () => {
      ;(document.getElementById(buttonId) as HTMLElement | null)?.focus()
    }
  }, [buttonId])

  // Arrow key navigation scoped to the panel — no interference with global handlers.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    function onKeyDown(e: KeyboardEvent) {
      const items = Array.from(
        panel!.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR),
      )
      if (!items.length) return

      const index = items.indexOf(document.activeElement as HTMLElement)

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          items[(index + 1) % items.length].focus()
          break
        case "ArrowUp":
          e.preventDefault()
          items[
            index < 0
              ? items.length - 1
              : (index - 1 + items.length) % items.length
          ].focus()
          break
        case "Home":
          e.preventDefault()
          items[0].focus()
          break
        case "End":
          e.preventDefault()
          items[items.length - 1].focus()
          break
      }
    }

    panel.addEventListener("keydown", onKeyDown)
    return () => panel.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div
      ref={panelRef}
      id={panelId}
      className={`${style.panel} ${positionClass}`}
      role="menu"
      aria-labelledby={buttonId}
      onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}
