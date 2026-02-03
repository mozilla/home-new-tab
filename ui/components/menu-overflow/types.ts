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
 * Props for {@link MenuOverflowTrigger}.
 */
export type MenuOverflowTriggerProps = {
  /**
   * Accessible label for the trigger button.
   * This becomes the trigger's accessible name and is used by screen readers.
   */
  ariaLabel?: string

  /**
   * Optional trigger content.
   * If omitted, a default kebab icon is rendered.
   */
  children?: React.ReactNode
}

/**
 * MenuOverflowTrigger
 * ---
 * Standard trigger button for {@link MenuOverflow}.
 *
 * This is intentionally always rendered as a <button> to keep accessibility
 * and styling consistent.
 */
export type MenuOverflowTrigger = (
  props: MenuOverflowTriggerProps,
) => React.ReactNode

/**
 * Props for {@link MenuOverflowPanel}.
 */
export type MenuOverflowPanelProps = {
  /**
   * Menu content.
   *
   * Notes:
   * - Prefer `role="menuitem"` / `role="menuitemcheckbox"` on children buttons.
   * - Use `withClose` from {@link MenuOverflowApi} for items that should close after click.
   */
  children: React.ReactNode
}

/**
 * MenuOverflowPanel
 * ---
 * Panel slot for {@link MenuOverflow}.
 *
 * Only renders when the menu is open.
 */
export type MenuOverflowPanel = (
  props: MenuOverflowPanelProps,
) => React.ReactNode

/**
 * Slots exposed to {@link MenuOverflowProps.children}.
 *
 * This API keeps composition explicit and consistent:
 * - {@link MenuOverflowSlots.Trigger} is the trigger button.
 * - {@link MenuOverflowSlots.Panel} is the menu panel container.
 * - {@link MenuOverflowApi.withClose} helps close the menu after an action.
 */
export type MenuOverflowSlots = MenuOverflowApi & {
  /** Standard trigger button slot. */
  Trigger: MenuOverflowTrigger

  /** Panel slot (only renders when open). */
  Panel: MenuOverflowPanel
}

/**
 * Props for {@link MenuOverflow}.
 */
export type MenuOverflowProps = {
  /** Small optional test id string for automation. */
  testid?: string

  /**
   * Fixed placement hint for the panel relative to the trigger.
   *
   * Defaults to {@link MenuOverflowPosition.TOP_RIGHT}.
   */
  position?: MenuOverflowPosition

  /** When true, clicking outside the menu closes it (only while open). */
  closeOnOutsideClick?: boolean

  /** When true, pressing Escape closes the menu (only while open). */
  closeOnEscape?: boolean

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
   * Render function that receives Trigger/Panel slots and helper actions.
   */
  children: (slots: MenuOverflowSlots) => React.ReactNode
}

/**
 * Props for {@link OpenPanel}.
 */
export type OpenPanelProps = {
  /** Reference to the root container div (used for outside click detection). */
  rootRef: React.RefObject<HTMLDivElement | null>

  /** Unique ID of the trigger button (used for aria-labelledby). */
  buttonId: string

  /** Unique ID of the panel element (used for aria-controls). */
  panelId: string

  /** CSS class controlling panel position relative to trigger. */
  positionClass: string

  /** Whether clicking outside the panel should close it. */
  closeOnOutsideClick: boolean

  /** Whether pressing Escape should close the panel. */
  closeOnEscape: boolean

  /** Function to close the menu panel. */
  close: () => void

  /** Panel content to render. */
  children: React.ReactNode
}
