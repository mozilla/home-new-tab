import style from "./style.module.css"

import { useCallback, useEffect, useRef, useState } from "react"

import type {
  ModalComponent,
  OpenModalProps,
  UseModalOptions,
  UseModalReturn,
} from "./types"

export type { UseModalOptions, UseModalReturn, ModalProps } from "./types"

/**
 * useModal
 * ---
 * Hook for managing modal dialog state and rendering.
 *
 * Returns a Modal slot component and controls for opening, closing, and wrapping
 * actions that should close the modal on completion.
 *
 * Follows the same controlled/uncontrolled pattern as `useMenuOverflow`. One
 * addition: focus is captured on `open()` and restored to that element on close.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const modal = useModal()
 *
 *   return (
 *     <>
 *       <button onClick={modal.open}>Open</button>
 *       <modal.Modal aria-labelledby="title">
 *         <h2 id="title">Confirm</h2>
 *         <button onClick={modal.close}>Cancel</button>
 *         <button onClick={modal.withClose(handleConfirm)}>OK</button>
 *       </modal.Modal>
 *     </>
 *   )
 * }
 * ```
 *
 * @param options - Configuration options
 * @returns Hook API with Modal slot and control functions
 */
export function useModal(options: UseModalOptions = {}): UseModalReturn {
  const { isOpen: controlledIsOpen, onOpenChange, onOpen, onClose } = options

  const isControlled = controlledIsOpen !== undefined

  // Internal state (only used in uncontrolled mode)
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  // Use controlled value or internal state
  const isOpen = isControlled ? Boolean(controlledIsOpen) : internalIsOpen

  // Captures the element that had focus when the modal opened, for restoration on close
  const capturedFocusRef = useRef<Element | null>(null)

  /**
   * Unified state setter that handles both controlled and uncontrolled modes.
   *
   * Notes:
   * - In controlled mode, we delegate to onOpenChange.
   * - In uncontrolled mode, we update internal state.
   * - Avoids duplicate lifecycle calls when setting the same value.
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
   * Open the modal. Captures the currently focused element for focus return on close.
   * Stable identity so it can be safely used in callbacks.
   */
  const open = useCallback(() => {
    capturedFocusRef.current = document.activeElement
    setIsOpen(true)
  }, [setIsOpen])

  /**
   * Close the modal. Stable identity so it can be safely used in callbacks.
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
   * Wrap an action so it runs, then closes the modal.
   * Stable identity because it only depends on {@link close}.
   */
  const withClose: UseModalReturn["withClose"] = useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        fn(...args)
        close()
      },
    [close],
  )

  /**
   * Modal slot.
   *
   * Only renders while open, and delegates dialog behavior to {@link OpenModal}.
   */
  const Modal: ModalComponent = useCallback(
    ({ children, className }) => {
      if (!isOpen) return null

      return (
        <OpenModal
          close={close}
          capturedFocusRef={capturedFocusRef}
          className={className}>
          {children}
        </OpenModal>
      )
    },
    [isOpen, close],
  )

  return { isOpen, open, close, toggle, withClose, Modal }
}

/**
 * OpenModal
 * ---
 * Mounted only while the modal is open.
 *
 * Responsibilities:
 * - Call `showModal()` on the native `<dialog>` element on mount
 * - Intercept the `cancel` event (Escape key) and delegate to `close()`
 * - Detect backdrop clicks and close when the click target is the dialog itself
 * - Restore focus to the captured element on unmount
 *
 * Performance:
 * - This component is intentionally not rendered when closed, so closed modals
 *   are cheap even when many instances exist on the page.
 */
function OpenModal({
  close,
  capturedFocusRef,
  children,
  className,
}: OpenModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Call showModal() on mount and restore focus on unmount
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    dialog.showModal()

    return () => {
      const captured = capturedFocusRef.current
      if (captured && document.contains(captured)) {
        ;(captured as HTMLElement).focus()
      }
    }
  }, [capturedFocusRef])

  // Focus trap: keep Tab and Shift+Tab cycling within the dialog.
  // Native showModal() inerts outside content in standard browser contexts, but this
  // explicit trap ensures correct behavior in iframes and embedded environments (e.g. Storybook).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      )

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    dialog.addEventListener("keydown", onKeyDown)
    return () => dialog.removeEventListener("keydown", onKeyDown)
  }, [])

  // Intercept the native cancel event (fired by Escape) to keep React state in sync.
  // preventDefault() stops the browser from closing the dialog directly; we close via state.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onCancel = (e: Event) => {
      e.preventDefault()
      close()
    }

    dialog.addEventListener("cancel", onCancel)
    return () => dialog.removeEventListener("cancel", onCancel)
  }, [close])

  /**
   * Detect backdrop clicks.
   *
   * When the click target is the dialog element itself (not a descendant), the
   * user clicked the ::backdrop area.
   */
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      close()
    }
  }

  const classes = [style.dialog, className].filter(Boolean).join(" ")

  return (
    // <dialog> is a native interactive element. Keyboard dismiss (Escape) is handled via
    // the cancel event above. onClick here detects ::backdrop clicks only (e.target === dialog).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      data-modal
      className={classes}
      onClick={handleClick}>
      {children}
    </dialog>
  )
}
