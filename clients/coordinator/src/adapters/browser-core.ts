import type { BrowserCoreAdapter, LinkTarget } from "@common/types"
import type { FrecentSite, Message, TopSitesData } from "@common/types"

// Dev mock data. In production, getData() delegates to native browser APIs
// (Places, ASRouter, Nimbus) without any coordinator knowledge of the shape.

const DEV_FRECENT_SITES: FrecentSite[] = [
  { url: "https://www.example.com", title: "Example" },
  { url: "https://www.wikipedia.org", title: "Wikipedia" },
  { url: "https://www.github.com", title: "GitHub" },
]

const DEV_MESSAGES: Message[] = [
  { id: "msg-onboarding-modal", surface: "modal", content: {} },
  { id: "msg-wallpaper-highlight", surface: "feature-highlight", content: {} },
  { id: "msg-topic-prompt", surface: "inline-prompt", content: {} },
  { id: "msg-report-toast", surface: "toast", content: {} },
]

/**
 * Dispatches a core schema key to a dev mock data source.
 * In production, the native browser core API handles this dispatch directly.
 */
async function getData(key: string): Promise<unknown> {
  switch (key) {
    case "topSites": {
      const topSites: TopSitesData = { frecent: DEV_FRECENT_SITES }
      return topSites
    }
    case "messages":
      return DEV_MESSAGES
    default:
      return null
  }
}

function trace(method: string, data?: Record<string, unknown>): void {
  void globalThis
    .fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: `browserCore.${method}`, data }),
    })
    .catch(() => {})
}

function openLink(url: string, target: LinkTarget = "current"): void {
  console.log("[browser-core] openLink", { url, target })
  trace("openLink", { url, target })
}

function bookmarkUrl(url: string, title: string): void {
  console.log("[browser-core] bookmarkUrl", { url, title })
  trace("bookmarkUrl", { url, title })
}

function deleteBookmark(id: string): void {
  console.log("[browser-core] deleteBookmark", { id })
  trace("deleteBookmark", { id })
}

function deleteHistory(url: string): void {
  console.log("[browser-core] deleteHistory", { url })
  trace("deleteHistory", { url })
}

function handoffSearch(query: string): void {
  console.log("[browser-core] handoffSearch", { query })
  trace("handoffSearch", { query })
}

function reportContent(url: string): void {
  console.log("[browser-core] reportContent", { url })
  trace("reportContent", { url })
}

function deleteUserData(): void {
  console.log("[browser-core] deleteUserData")
  trace("deleteUserData")
}

/**
 * Returns a BrowserCoreAdapter backed by dev stubs and static mock data.
 * In production, replaced by a native browser core implementation.
 */
export function createDevBrowserCore(): BrowserCoreAdapter {
  return {
    getData,
    openLink,
    bookmarkUrl,
    deleteBookmark,
    deleteHistory,
    handoffSearch,
    reportContent,
    deleteUserData,
  }
}
