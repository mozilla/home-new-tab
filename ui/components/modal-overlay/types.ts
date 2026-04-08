/**
 * Options for {@link useModal} hook.
 */
export type UseModalOptions = {
  /**
   * Optional: controlled open state.
   * When provided, the hook operates in controlled mode.
   */
  isOpen?: boolean

  /**
   * Optional: callback for open state changes in controlled mode.
   * Called with the new open state when the modal should open or close.
   */
  onOpenChange?: (isOpen: boolean) => void

  /** Optional: called when the modal opens. */
  onOpen?: () => void

  /** Optional: called when the modal closes. */
  onClose?: () => void
}

/**
 * Props for the Modal slot component returned by {@link useModal}.
 *
 * Notes:
 * - Supply `aria-label` or `aria-labelledby` on a per-dialog basis to name the dialog.
 * - `className` is merged with the base dialog class; use it for size and layout overrides.
 * - Focus is trapped inside the dialog by the browser via `showModal()` — Tab and Shift+Tab
 *   cycle only within focusable elements inside the modal. No extra implementation needed.
 * - Initial focus placement is the consumer's responsibility. Add `autoFocus` to the element
 *   that should receive focus when the modal opens (the primary action, first field, etc.).
 */
export type ModalProps = {
  /** Dialog content. */
  children: React.ReactNode

  /** Optional class merged with the base dialog styles. */
  className?: string
}

/**
 * Modal slot component returned by {@link useModal}.
 *
 * Only renders while the modal is open.
 */
export type ModalComponent = (props: ModalProps) => React.ReactNode

/**
 * Return type for {@link useModal} hook.
 *
 * Fields:
 * - isOpen: Whether the modal is currently rendered.
 * - open: Open the modal. Captures focus for restoration on close.
 * - close: Close the modal.
 * - toggle: Toggle open/close state.
 * - withClose: Wrap an action so it runs, then closes the modal.
 * - Modal: The dialog slot component.
 */
export type UseModalReturn = {
  /** Whether the modal is currently rendered. */
  isOpen: boolean

  /** Open the modal. Captures the active element for focus restoration on close. */
  open: () => void

  /** Close the modal. */
  close: () => void

  /** Toggle open/close state. */
  toggle: () => void

  /** Wrap an action so it runs, then closes the modal. */
  withClose: <A extends unknown[]>(
    fn: (...args: A) => void,
  ) => (...args: A) => void

  /** Dialog slot component. Only renders while open. */
  Modal: ModalComponent
}

/**
 * Props for the internal {@link OpenModal} component.
 */
export type OpenModalProps = {
  /** Function to close the modal. */
  close: () => void

  /** Ref to the element that had focus when the modal opened. Restored on close. */
  capturedFocusRef: React.RefObject<Element | null>

  /** Dialog content. */
  children: React.ReactNode

  /** Optional class merged with the base dialog styles. */
  className?: string
}
