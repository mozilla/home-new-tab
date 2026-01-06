import { create } from "zustand"

/**
 * Runtime status of a timer.
 */
export const TimerStatus = {
  Idle: "idle",
  Running: "running",
  Paused: "paused",
}
export type TimerStatus = (typeof TimerStatus)[keyof typeof TimerStatus]

/**
 * Data kept inside the Zustand store for each timer (no methods here).
 * Components should select from these fields to re-render efficiently.
 */
export interface TimerData {
  id: string
  label?: string
  totalTime: number
  elapsedMs: number
  status: TimerStatus
}

/**
 * An imperative handle bound to a specific timer id.
 * Returned from `create` and re-creatable via `bind(id)`.
 */
export interface TimerHandle {
  id: string
  start: () => void
  pause: () => void
  reset: () => void
  setLabel: (label: string) => void
  setTotalTime: (ms: number) => void
  dispose: () => void
}

/**
 * Internal ticker state (one global interval for all running timers).
 */
type IntervalHandle = ReturnType<typeof setInterval> | null

/**
 * Root store shape. Public API: create/destroy/has/get/list/bind.
 * The store holds only data; methods live on bound handles.
 */
interface TimersState {
  timers: Map<string, TimerData>

  create: (label: string, initialTime: number) => TimerHandle // Create a timer and return a bound handle for it.
  destroy: (id: string) => void // Destroy a timer by id. Safe to call on non-existent ids.
  has: (id: string) => boolean // Check if a timer exists. Useful for guards/selectors.
  get: (id: string) => TimerData | undefined // Snapshot read of a timer's data (non-reactive).
  list: () => TimerData[] // Snapshot of all timers' data (non-reactive).
  bind: (id: string) => TimerHandle // Create a fresh bound handle for an existing timer id. Don't create the timer if missing.

  // internals for ticker
  _runningCount: number
  _ticker: { handle: IntervalHandle; lastTs: number | null }
}

/**
 * Generate a unique id under the given map using a numeric suffix scheme.
 * "focus" → "focus-2" → "focus-3", etc.
 */
function uniqueId(base: string, map: Map<string, unknown>): string {
  if (!map.has(base)) return base
  let i = 2
  while (map.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

/**
 * The main Zustand store that catalogs timers and runs a single global ticker.
 * Timers continue to tick or stay paused regardless of component presence.
 */
export const useTimers = create<TimersState>((set, get) => {
  //Patch a single timer's data by id. Creates new Map/object instances to trigger subscriptions correctly.
  const setTimerData = (
    id: string,
    patch: Partial<TimerData> | ((prev: TimerData) => Partial<TimerData>),
  ) => {
    set((s) => {
      const prev = s.timers.get(id)
      if (!prev) return {}
      const next = typeof patch === "function" ? patch(prev) : patch
      const timers = new Map(s.timers)
      timers.set(id, { ...prev, ...next })
      return { timers }
    })
  }

  // Apply elapsed time to all running timers in a single write.  Keeps updates cheap when many timers are running.
  const tickAll = (delta: number) => {
    if (delta <= 0) return
    set((s) => {
      let changed = false
      const timers = new Map(s.timers)
      s.timers.forEach((t, id) => {
        if (t.status === "running") {
          changed = true
          timers.set(id, { ...t, elapsedMs: t.elapsedMs + delta })
        }
      })
      return changed ? { timers } : {}
    })
  }

  //Ensure the global ticker interval is running. Uses a ~20fps cadence (50ms);
  const ensureTicker = () => {
    const t = get()._ticker
    if (t.handle) return
    const startedAt = Date.now()
    const handle = setInterval(() => {
      const prev = get()._ticker.lastTs ?? Date.now()
      const curr = Date.now()
      // First record the current tick time...
      set((s) => ({ _ticker: { ...s._ticker, lastTs: curr } }))
      // ...then propagate elapsed to all running timers.
      tickAll(curr - prev)
    }, 50)
    set({ _ticker: { handle, lastTs: startedAt } })
  }

  //Stop the global ticker if no timers are running.
  const stopTickerIfIdle = () => {
    const { _runningCount, _ticker } = get()
    if (_runningCount === 0 && _ticker.handle) {
      clearInterval(_ticker.handle)
      set({ _ticker: { handle: null, lastTs: null } })
    }
  }

  //Bookkeeping around how many timers are running to spin the global ticker up/down automatically.
  const onRunningChange = (_id: string, isRunning: boolean) => {
    set((s) => ({
      _runningCount: Math.max(0, s._runningCount + (isRunning ? 1 : -1)),
    }))
    if (isRunning) ensureTicker()
    else stopTickerIfIdle()
  }

  // Produce a bound handle for a given id. The handle operates purely by calling back into the store, so it never goes stale.
  const bind = (id: string): TimerHandle => ({
    id,
    start: () => {
      const t = get().timers.get(id)
      if (!t || t.status === TimerStatus.Running) return
      setTimerData(id, { status: TimerStatus.Running })
      onRunningChange(id, true)
    },
    pause: () => {
      const t = get().timers.get(id)
      if (!t || t.status !== TimerStatus.Running) return
      setTimerData(id, { status: TimerStatus.Paused })
      onRunningChange(id, false)
    },
    reset: () => {
      const t = get().timers.get(id)
      if (!t) return
      const wasRunning = t.status === TimerStatus.Running
      setTimerData(id, { elapsedMs: 0, status: TimerStatus.Idle })
      if (wasRunning) onRunningChange(id, false)
    },
    setTotalTime: (totalTime) => setTimerData(id, { totalTime }),
    setLabel: (label: string) => setTimerData(id, { label }),
    dispose: () => get().destroy(id),
  })

  // Store body (public API + internals)
  return {
    timers: new Map(),
    _runningCount: 0,
    _ticker: { handle: null, lastTs: null },
    create: (label, initialTime) => {
      const id = uniqueId(label, get().timers)

      // seed data slice
      set((s) => {
        const timers = new Map(s.timers)
        timers.set(id, {
          id,
          label,
          elapsedMs: 0,
          totalTime: initialTime,
          status: TimerStatus.Idle,
        })
        return { timers }
      })

      return bind(id)
    },
    destroy: (id) => {
      const t = get().timers.get(id)
      if (!t) return
      if (t.status === "running") onRunningChange(id, false)
      set((s) => {
        const timers = new Map(s.timers)
        timers.delete(id)
        return { timers }
      })
    },
    has: (id) => get().timers.has(id),
    get: (id) => get().timers.get(id),
    list: () => Array.from(get().timers.values()),
    bind,
  }
})

/**
 * React selector hook for a specific timer's data.
 * Throws if the timer does not exist (use `useTimerExists` to guard).
 */
export function useTimer<T>(id: string, selector: (t: TimerData) => T): T {
  return useTimers((s) => {
    const t = s.timers.get(id)
    if (!t) throw new Error(`Timer ${id} not found`)
    return selector(t)
  })
}

/**
 * React selector hook that returns a stable boolean for existence checks.
 * Useful to gate rendering or creation side-effects without re-rendering
 * on every tick.
 */
export const useTimerExists = (id: string) => useTimers((s) => s.has(id))
