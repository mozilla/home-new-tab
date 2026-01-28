import style from "./style.module.css"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"

/**
 * Runtime API exposed to {@link MenuOverflowProps.children}.
 *
 * Fields:
 * - isOpen: Whether the menu panel is currently rendered.
 * - close: Close the menu panel.
 * - toggle: Toggle open/close state.
 * - withClose: Wrap an action so it runs, then closes the menu.
 *
 * Consumers decide whether menu items close the panel:
 * - Call {@link MenuOverflowApi.close} directly, or
 * - Wrap actions with {@link MenuOverflowApi.withClose}.
 */
export type MenuOverflowApi = {
  /** Whether the menu panel is currently rendered. */
  isOpen: boolean

  /** Close the menu panel. */
  close: () => void

  /** Toggle open/close state. */
  toggle: () => void

  /** Wrap an action so it runs, then closes the menu. */
  withClose: <A extends unknown[]>(
    fn: (...args: A) => void,
  ) => (...args: A) => void
}

/**
 * Supported placements for {@link MenuOverflow}.
 *
 * Intentionally limited to the four screen corners.
 */
export const MenuOverflowPosition = {
  TOP_LEFT: "top-left",
  TOP_RIGHT: "top-right",
  BOTTOM_LEFT: "bottom-left",
  BOTTOM_RIGHT: "bottom-right",
} as const

export type MenuOverflowPosition = (typeof MenuOverflowPosition)[keyof typeof MenuOverflowPosition] //prettier-ignore

/**
 * Props for {@link MenuOverflow}.
 */
export type MenuOverflowProps = {
  /** Accessible label for the trigger button. */
  ariaLabel?: string

  /** Small optional test id string for automation */
  testid?: string

  /**
   * Fixed placement of the menu wrapper.
   *
   * Defaults to {@link MenuOverflowPosition.TOP_RIGHT}.
   */
  position?: MenuOverflowPosition

  /** When true, clicking outside the menu closes it (only while open). */
  closeOnOutsideClick?: boolean

  /** When true, pressing Escape closes the menu (only while open). */
  closeOnEscape?: boolean

  /** Will render a default trigger. If you want a custom trigger, set this to false */
  withTrigger?: boolean

  /** Optional: called when the menu opens. */
  onOpen?: () => void

  /** Optional: called when the menu closes. */
  onClose?: () => void

  /**
   * Optional: controlled state for menu open/close.
   * When provided, MenuOverflow operates in controlled mode.
   */
  isOpen?: boolean

  /**
   * Optional: callback for state changes in controlled mode.
   * Called with the new open state when the menu should open or close.
   */
  onOpenChange?: (isOpen: boolean) => void

  /**
   * Menu content renderer. Receives {@link MenuOverflowApi}.
   *
   * Notes:
   * - Prefer `role="menuitem"` / `role="menuitemcheckbox"` on children buttons.
   * - Use `withClose` for items that should close after click.
   */
  children: (api: MenuOverflowApi) => React.ReactNode
}

/**
 * MenuOverflow
 * ---
 * A tiny, self-contained overflow menu wrapper.
 *
 * Usage:
 * Important to note that _children_ expects a function ()=>{<>ITEMS HERE</>}
 * - exposes withClose to help close on click for specific items
 * - exposes close ... to close the menu explicitly
 * - exposes toggle to help with async callback situations or custom triggers
 *
 * Responsibilities:
 * - Own local open/close state
 * - Render a trigger button and a positioned panel (currently only "top-right")
 * - Provide control helpers so children decide when to close
 * - Close on Escape and/or outside click while open (configurable)
 *
 * Accessibility:
 * - Trigger uses aria-haspopup/expanded/controls
 * - Panel uses role="menu" and is linked with aria-labelledby
 *
 * Things to do:
 * - Focus trapping or full keyboard roving (arrow key navigation)
 */
export function MenuOverflow({
  ariaLabel = "Menu",
  testid,
  position = MenuOverflowPosition.TOP_RIGHT,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  withTrigger = true,
  onOpen,
  onClose,
  isOpen: controlledIsOpen,
  onOpenChange,
  children,
}: MenuOverflowProps) {
  const uid = useId()

  // Avoiding collisions with multiple menus on the page
  const buttonId = useMemo(() => `menu-overflow-button-${uid}`, [uid])
  const panelId = useMemo(() => `menu-overflow-panel-${uid}`, [uid])

  const rootRef = useRef<HTMLDivElement | null>(null)

  // Determine if we're in controlled mode
  const isControlled = controlledIsOpen !== undefined

  // Internal state (only used in uncontrolled mode)
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  // Use controlled value or internal state
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen

  /**
   * Unified state setter that handles both controlled and uncontrolled modes.
   * Calls onOpen/onClose lifecycle callbacks and onOpenChange for controlled mode.
   */
  const setIsOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const nextValue = typeof value === "function" ? value(isOpen) : value

      if (isControlled) {
        // In controlled mode, call onOpenChange to update parent state
        onOpenChange?.(nextValue)
      } else {
        // In uncontrolled mode, update internal state
        setInternalIsOpen(nextValue)
      }

      // Call lifecycle callbacks
      if (nextValue) {
        onOpen?.()
      } else {
        onClose?.()
      }
    },
    [isControlled, isOpen, onOpenChange, onOpen, onClose],
  )

  /**
   * Close the menu. Stable identity so it can be safely used in effect deps.
   */
  const close = useCallback(() => {
    setIsOpen(false)
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

  useEffect(() => {
    if (!isOpen) return

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
  }, [isOpen, closeOnEscape, closeOnOutsideClick, close])

  const POSITION_CLASS: Record<MenuOverflowPosition, string> = {
    [MenuOverflowPosition.TOP_LEFT]: style.panelFromTopLeft,
    [MenuOverflowPosition.TOP_RIGHT]: style.panelFromTopRight,
    [MenuOverflowPosition.BOTTOM_LEFT]: style.panelFromBottomLeft,
    [MenuOverflowPosition.BOTTOM_RIGHT]: style.panelFromBottomRight,
  }
  const positionClass = POSITION_CLASS[position]

  const api: MenuOverflowApi = useMemo(
    () => ({ isOpen, toggle, close, withClose }),
    [isOpen, close, toggle, withClose],
  )

  return (
    <div
      ref={rootRef}
      className={style.base}
      {...(testid ? { "data-testid": testid } : {})}>
      {withTrigger ? (
        <button
          id={buttonId}
          type="button"
          className={style.overflow}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={toggle}>
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
        </button>
      ) : null}
      {isOpen ? (
        <div
          id={panelId}
          className={`${style.panel} ${positionClass}`}
          role="menu"
          aria-labelledby={buttonId}>
          {children(api)}
        </div>
      ) : null}
    </div>
  )
}
