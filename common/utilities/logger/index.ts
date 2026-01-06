type LogArgs = Parameters<typeof console.log>
interface Logger {
  log(...args: LogArgs): void
  info(...args: LogArgs): void
  warn(...args: LogArgs): void
  error(...args: LogArgs): void
  display(): void
}

enum LEVEL {
  "LOG" = "log",
  "INFO" = "info",
  "WARN" = "warn",
  "ERROR" = "error",
}

interface BufferedEntry {
  level: LEVEL
  args: LogArgs
  timestamp: number
}

interface LoggerOptions {
  prefix?: string
  colors?: {
    log?: string
    info?: string
    warn?: string
    error?: string
    header?: string
  }
  shouldBuffer?: boolean
  groupLabel?: string
  exposeGlobalAs?: string
}

const defaultColors = {
  log: "#6aa84f",
  info: "#2986cc",
  warn: "#ffa500",
  error: "#f44336",
  header: "#674ea7",
}

const native = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
} as const

const start = performance.now()

export function createBufferedLogger(opts: LoggerOptions = {}): Logger {
  const {
    prefix,
    colors = defaultColors,
    groupLabel = "HNT",
    shouldBuffer = true,
  } = opts

  const buffer: BufferedEntry[] = []
  const captureMessage = function (level: LEVEL, args: LogArgs) {
    if (shouldBuffer) {
      buffer.push({ level, args, timestamp: performance.now() - start })
      return
    }

    const method = native[level]
    method(`%c[${prefix}]`, `color:${colors[level]}`, ...args)
  }

  const display = function () {
    console.group(groupLabel)
    for (const entry of buffer) {
      const method = native[entry.level]
      method(`%c[${prefix}]`, `color:${colors[entry.level]}`, ...entry.args)
    }
    console.groupEnd()
  }

  const logger: Logger = {
    log: (...args) => captureMessage(LEVEL.LOG, args),
    info: (...args) => captureMessage(LEVEL.LOG, args),
    warn: (...args) => captureMessage(LEVEL.LOG, args),
    error: (...args) => captureMessage(LEVEL.LOG, args),
    display,
  }

  return logger
}
