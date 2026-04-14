import "@ui/styles/global.css"

import { initFluentDom, type FluentDomRuntime } from "@common/l10n"
import { useCoordinatorInterface } from "@data/state/coordinator-interface"
import homeTabFtl from "virtual:fluent/home-tab/en-US"

import type { Preview, Decorator } from "@storybook/react-vite"

let started = false
let fluentRuntime: FluentDomRuntime | null = null
let currentMessages = homeTabFtl

// Populate the coordinator interface store once for all stories.
// This mirrors what init() does in the real renderer entry.
if (!useCoordinatorInterface.getState().initialized) {
  useCoordinatorInterface.getState().initialize({
    gatingPayload: {
      locale: {
        locale: "en-US",
        availability: "full",
        completeness: 1,
        l10nHash: "",
      },
      flags: {},
    },
    getMessages: async () => currentMessages,
    browserCore: {
      getData: async (_key) => null,
      openLink: (url) => console.log("[storybook] openLink", url),
      bookmarkUrl: (url, title) => console.log("[storybook] bookmarkUrl", { url, title }),
      deleteBookmark: (id) => console.log("[storybook] deleteBookmark", id),
      deleteHistory: (url) => console.log("[storybook] deleteHistory", url),
      handoffSearch: (query) => console.log("[storybook] handoffSearch", query),
      reportContent: (url) => console.log("[storybook] reportContent", url),
      deleteUserData: () => console.log("[storybook] deleteUserData"),
    },
    storage: {
      read: (key) => localStorage.getItem(key),
      write: (key, value) => localStorage.setItem(key, value),
      delete: (key) => localStorage.removeItem(key),
    },
    telemetry: {
      reportError: (report) => console.warn("[storybook] reportError", report),
      reportMetric: (report) => console.log("[storybook] reportMetric", report),
    },
  })
}

export const withL10n: Decorator = (Story) => {
  if (!started) {
    started = true

    const root = document.documentElement
    root.setAttribute("data-l10n-ready", "false")

    initFluentDom({
      locale: "en-US",
      roots: [root],
      getMessages: async () => currentMessages,
    }).then((runtime) => {
      fluentRuntime = runtime
      root.setAttribute("data-l10n-ready", "true")
    })
  }

  return <Story />
}

if (import.meta.hot) {
  import.meta.hot.on(
    "fluent:bundle-updated",
    async (data: { version: number; ftl: string }) => {
      currentMessages = data.ftl

      if (!fluentRuntime) {
        return
      }

      fluentRuntime.clearCache()

      await fluentRuntime.setLocales({
        locale: "en-US",
      })
    },
  )
}

const wallpapers = [
  "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/e94b1e49-c518-40d6-98e3-dffab6cc370d.avif",
  "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/f5c362af-16df-488d-a8b2-bf8cf29d1c63.avif",
  "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/32c50b87-9f4b-46cf-a467-f4aa768a1687.avif",
  "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/036ac885-33cb-41db-bcbb-52dd49254a12.avif",
  "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/13495d0e-f975-4218-b5f0-c841c69ce2e5.avif",
  "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/d357925c-b9cd-417e-8731-14272f28f556.avif",
]

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme for components",
      defaultValue: "system",
      toolbar: {
        icon: "sun",
        items: ["system", "light", "dark"],
        dynamicTitle: true,
      },
    },
    wallpaper: {
      name: "Wallpaper",
      description: "Wallpaper to use as background for testing",
      defaultValue: null,
      toolbar: {
        icon: "photo",
        items: wallpapers,
        dynamicTitle: false,
      },
    },
  },
  decorators: [
    withL10n,
    (Story, context) => {
      document.body.classList.remove("colormode-system")
      document.body.classList.remove("colormode-light")
      document.body.classList.remove("colormode-dark")
      document.body.classList.add(`colormode-${context.globals.theme}`)

      document.body.style.backgroundImage = `url(${context.globals.wallpaper})`

      return (
        <div style={{ minHeight: "100vh" }}>
          <div className="body-wrapper">
            <Story {...context} />
          </div>
        </div>
      )
    },
  ],
}

export default preview
