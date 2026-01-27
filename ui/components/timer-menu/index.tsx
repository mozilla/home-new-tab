import { MenuOverflow } from "../menu-overflow"
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
 * Uses {@link MenuOverflow} for local open/close state and menu shell behavior.
 * Updates preferences via {@link TimerActions.setPreferences}.
 */
export function TimerMenu() {
  const autoSwitchEnabled = useTimer(
    (s) => s.shared.data.preferences.autoSwitchEnabled,
  )
  const autoStartNextPhase = useTimer(
    (s) => s.shared.data.preferences.autoStartNextPhase,
  )

  const setPreferences = useTimer((s) => s.actions.setPreferences)

  const isAutoStartAvailable = autoSwitchEnabled

  return (
    <MenuOverflow
      ariaLabel="Timer settings"
      testid="timer-menu"
      closeOnOutsideClick
      closeOnEscape>
      {() => (
        <>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={autoSwitchEnabled}
            onClick={() =>
              setPreferences({ autoSwitchEnabled: !autoSwitchEnabled })
            }>
            <span>Auto switch phases</span>
            <span>{autoSwitchEnabled ? "On" : "Off"}</span>
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
            <span>Auto start break</span>
            <span>{autoStartNextPhase ? "On" : "Off"}</span>
          </button>
        </>
      )}
    </MenuOverflow>
  )
}
