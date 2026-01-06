import "@ui/styles/global.css" // This is our base styles

import type { Preview } from "@storybook/react-vite"

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
        // array of plain string values or MenuItem shape
        items: ["system", "light", "dark"],
        // Property that specifies if the name of the item will be displayed
        showName: true,
        // Change title based on selected value
        dynamicTitle: true,
      },
    },
    wallpaper: {
      name: "Wallpaper",
      description: "Wallpaper to use as background for testing",
      defaultValue: null,
      toolbar: {
        icon: "photo",
        // array of plain string values or MenuItem shape
        items: wallpapers,
        // Property that specifies if the name of the item will be displayed
        showName: false,
        // Change title based on selected value
        dynamicTitle: false,
      },
    },
  },
  decorators: [
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
