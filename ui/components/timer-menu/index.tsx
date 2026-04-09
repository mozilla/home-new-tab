import { useMenuOverflow } from "../menu-overflow"
import { useTimer } from "@data/state/timer"

/**
 * TimerMenu
 * ---
 * Overflow menu for toggle-able timer preferences.
 *
 * This menu intentionally does NOT include:
 * - duration editing (handled elsewhere)
 * - lifecycle actions (start/pause/reset/switch), as those are part of the core UI
 *
 * Uses {@link useMenuOverflow} for local open/close state and menu shell behavior.
 * Updates preferences via {@link TimerActions.setPreferences}.
 */
export function TimerMenu() {
  const autoSwitchEnabled = useTimer(
    (s) => s.data.preferences.autoSwitchEnabled,
  )
  const autoStartNextPhase = useTimer(
    (s) => s.data.preferences.autoStartNextPhase,
  )

  const setPreferences = useTimer((s) => s.actions.setPreferences)

  const isAutoStartAvailable = autoSwitchEnabled

  const menu = useMenuOverflow({
    closeOnOutsideClick: true,
    closeOnEscape: true,
  })

  return (
    <div ref={menu.rootRef} data-testid="timer-menu">
      <menu.Trigger ariaLabel="Timer settings" />
      <menu.Panel>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={autoSwitchEnabled}
          onClick={() =>
            setPreferences({ autoSwitchEnabled: !autoSwitchEnabled })
          }>
          <span data-l10n-id="timer-menu-auto-switch" />
          <span
            data-l10n-id={
              autoSwitchEnabled
                ? "timer-menu-preference-on"
                : "timer-menu-preference-off"
            }
          />
        </button>

        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={autoStartNextPhase}
          aria-disabled={!isAutoStartAvailable}
          onClick={() => {
            if (!isAutoStartAvailable) return
            setPreferences({ autoStartNextPhase: !autoStartNextPhase })
          }}>
          <span data-l10n-id="timer-menu-auto-start-break" />
          <span
            data-l10n-id={
              autoStartNextPhase
                ? "timer-menu-preference-on"
                : "timer-menu-preference-off"
            }
          />
        </button>
      </menu.Panel>
    </div>
  )
}
