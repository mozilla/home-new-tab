import style from "./style.module.css"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { MenuOverflowPosition } from "./types"

import type { MouseEvent } from "react"
import type {
  MenuOverflowProps,
  MenuOverflowApi,
  MenuOverflowTrigger,
  MenuOverflowPanel,
  MenuOverflowSlots,
  OpenPanelProps,
} from "./types"

export { MenuOverflowPosition }

const POSITION_CLASS: Record<MenuOverflowPosition, string> = {
  [MenuOverflowPosition.TOP_LEFT]: style.panelFromTopLeft,
  [MenuOverflowPosition.TOP_RIGHT]: style.panelFromTopRight,
  [MenuOverflowPosition.BOTTOM_LEFT]: style.panelFromBottomLeft,
  [MenuOverflowPosition.BOTTOM_RIGHT]: style.panelFromBottomRight,
}

/**
 * MenuOverflow
 * ---
 * A tiny, self-contained overflow menu wrapper.
 *
 * Responsibilities:
 * - Own local open/close state (or operate in controlled mode)
 * - Provide Trigger/Panel slots to keep composition explicit and consistent
 * - Close on Escape and/or outside click while open (configurable)
 *
 * Performance notes:
 * - Intended to scale to many instances on a page (e.g. cards in a grid).
 * - Heavier work (global listeners + action wrappers) is mounted only while open.
 *
 * Accessibility:
 * - Trigger uses aria-haspopup/expanded/controls
 * - Panel uses role="menu" and is linked with aria-labelledby
 */
export function MenuOverflow({
  testid,
  position = MenuOverflowPosition.TOP_RIGHT,
  closeOnOutsideClick = true,
  closeOnEscape = true,
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

  /**
   * Trigger slot.
   *
   * Always a <button>, with optional children that replace the default icon.
   */
  const Trigger: MenuOverflowTrigger = useCallback(
    ({ ariaLabel = "Menu", children }) => {
      const handleTriggerClick = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        toggle()
      }
      return (
        <button
          id={buttonId}
          type="button"
          className={style.overflow}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
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
    [buttonId, isOpen, panelId, toggle],
  )

  /**
   * Panel slot.
   *
   * Only renders while open, and delegates global listeners + container rendering
   * to {@link OpenPanel}.
   */
  const Panel: MenuOverflowPanel = useCallback(
    ({ children: panelChildren }) => {
      if (!isOpen) return null

      return (
        <OpenPanel
          rootRef={rootRef}
          buttonId={buttonId}
          panelId={panelId}
          positionClass={positionClass}
          closeOnOutsideClick={closeOnOutsideClick}
          closeOnEscape={closeOnEscape}
          close={close}>
          {panelChildren}
        </OpenPanel>
      )
    },
    [
      isOpen,
      buttonId,
      panelId,
      positionClass,
      closeOnOutsideClick,
      closeOnEscape,
      close,
    ],
  )

  const slots: MenuOverflowSlots = useMemo(
    () => ({ isOpen, close, toggle, withClose, Trigger, Panel }),
    [isOpen, close, toggle, withClose, Trigger, Panel],
  )

  return (
    <div
      ref={rootRef}
      className={style.base}
      {...(testid ? { "data-testid": testid } : {})}>
      {children(slots)}
    </div>
  )
}

/**
 * OpenPanel
 * ---
 * Mounted only while the menu is open.
 *
 * Responsibilities:
 * - Register global listeners (Escape + outside click)
 * - Render the positioned panel container
 *
 * Performance:
 * - This component is intentionally not rendered when closed, so closed menus are cheap
 *   even when many instances exist on the page.
 */
function OpenPanel({
  rootRef,
  buttonId,
  panelId,
  positionClass,
  closeOnOutsideClick,
  closeOnEscape,
  close,
  children,
}: OpenPanelProps) {
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

  return (
    <div
      id={panelId}
      className={`${style.panel} ${positionClass}`}
      role="menu"
      aria-labelledby={buttonId}
      onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}
