import style from "./style.module.css"

import {
  msToMinutes,
  minutesToMs,
  parseNumber,
  formatMMSS,
} from "@common/utilities/time"
import { useEffect, useMemo, useRef, useState } from "react"

import type { ChangeEvent, KeyboardEvent } from "react"

type TimerPhase = "focus" | "break"

type TimerLabelProps = {
  phase: TimerPhase
  isRunning: boolean
  remainingSeconds: number
  totalMs: number
  pause: () => void
  setPhaseDurationMs: (phase: TimerPhase, durationMs: number) => void

  /** Minutes-only bounds (UI guardrails; domain should still clamp) */
  minMinutes?: number
  maxMinutes?: number

  /** Max digits allowed in the minutes editor (2 => 00–99) */
  maxDigits?: number
}

/**
 * TimerLabel
 * ---------------------------------------------------------
 * Displays a stable "MM:SS" label and supports inline editing of the minutes
 * portion without layout shift.
 *
 * Simplified commit model:
 * - No debouncing and no incremental commits while typing.
 * - Commit happens only on blur or Enter.
 * - Escape discards the draft and restores the last authoritative value.
 *
 * UX:
 * - Clicking the label pauses immediately (if running), then enters edit mode.
 * - Input accepts digits only and is capped to `maxDigits`.
 */
export function TimerLabel({
  phase,
  remainingSeconds,
  isRunning,
  totalMs,
  pause,
  setPhaseDurationMs,
  minMinutes = 1,
  maxMinutes = 99,
  maxDigits = 2,
}: TimerLabelProps) {
  const [isEditing, setIsEditing] = useState(false)

  const minutesFromState = useMemo(
    () => String(msToMinutes(totalMs)),
    [totalMs],
  )

  // Draft is minutes-only, as a string for partial edits.
  const [draft, setDraft] = useState(minutesFromState)

  // Keep draft in sync with authoritative changes when not editing (cross-tab, etc.)
  useEffect(() => {
    if (!isEditing) setDraft(minutesFromState)
  }, [isEditing, minutesFromState])

  const inputRef = useRef<HTMLInputElement | null>(null)

  const beginEdit = () => {
    if (isRunning) pause()
    setIsEditing(true)
  }

  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  const cancelEdit = () => {
    setDraft(minutesFromState) // discard draft
    setIsEditing(false)
  }

  const commitIfValid = (raw: string) => {
    const n = parseNumber(raw)
    if (n == null) return

    const minutes = Math.floor(n)
    if (minutes < minMinutes || minutes > maxMinutes) return

    setPhaseDurationMs(phase, minutesToMs(minutes))
  }

  const finalizeEdit = () => {
    // Blank = treat as cancel
    if (draft.trim() === "") {
      cancelEdit()
      return
    }

    commitIfValid(draft)
    setIsEditing(false)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D+/g, "")
    const limited = digitsOnly.slice(0, maxDigits)
    setDraft(limited)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") finalizeEdit()
    if (e.key === "Escape") cancelEdit()
  }

  // Keep the visible footprint stable by always rendering MM:SS.
  const label = useMemo(() => formatMMSS(remainingSeconds), [remainingSeconds])
  const [minutesPart, secondsPart] = label.split(":")
  const safeMinutes = minutesPart ?? "00"
  const safeSeconds = secondsPart ?? "00"

  return (
    <div className={style.base} data-testid="timer-label">
      {!isEditing ? (
        <button
          type="button"
          className={style.timeLabelButton}
          onClick={beginEdit}
          aria-label={`Edit ${phase} duration`}>
          <span className={style.timeLabelWrap}>
            <span className={style.timeLabelMinutes}>{safeMinutes}</span>
            <span className={style.timeLabelSep}>:</span>
            <span className={style.timeLabelSeconds}>{safeSeconds}</span>
          </span>
        </button>
      ) : (
        <div className={style.timeLabelEditWrap}>
          <span className={style.timeLabelWrap}>
            <span className={style.timeLabelMinutes}>
              <input
                ref={inputRef}
                className={style.timeLabelMinutesInput}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={maxDigits}
                value={draft}
                onChange={onChange}
                onBlur={finalizeEdit}
                onKeyDown={onKeyDown}
                aria-label={`Set ${phase} minutes`}
              />
            </span>
            <span className={style.timeLabelSep}>:</span>
            <span className={style.timeLabelSeconds}>{safeSeconds}</span>
          </span>
        </div>
      )}
    </div>
  )
}
