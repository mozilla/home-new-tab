import type { ErrorReport, MetricReport } from "./reporting"

export type LinkTarget = "current" | "new-tab" | "new-window" | "private"

export type HostCallbacks = {
  // L10n
  getMessages: (locale: string) => Promise<string>

  // Reporting
  reportError?: (report: ErrorReport) => void
  reportMetric?: (report: MetricReport) => void

  // Content actions
  blockUrl?: (url: string) => void
  bookmarkUrl?: (url: string) => void
  deleteBookmark?: (id: string) => void
  deleteHistory?: (url: string) => void
  openLink?: (url: string, target: LinkTarget) => void
  reportContent?: (url: string) => void

  // Top sites
  pinSite?: (url: string, index: number) => void
  unpinSite?: (url: string) => void

  // Search
  searchHandoff?: (query: string) => void

  // Message lifecycle
  messageImpressed?: (id: string) => void
  messageDismissed?: (id: string) => void
  messageCompleted?: (id: string) => void
  messageBlocked?: (id: string) => void
}
