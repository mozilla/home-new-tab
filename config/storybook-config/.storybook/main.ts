import type { StorybookConfig } from "@storybook/react-vite"
import svgr from "vite-plugin-svgr"
import fluentL10n from "@config/l10n-config"

import { createRequire } from "node:module"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Silliness due to ESM vs Common in the node ecosystem
// !! Check for removal when node version is bumped (current 23)
const require = createRequire(import.meta.url)

/**
 * Resolve absolute repo root from this file location.
 * main.ts is at: <root>/config/storybook-config/.storybook/main.ts
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, "../../..")

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")))
}
const config: StorybookConfig = {
  stories: [join(repoRoot, "ui/components/**/*.story.tsx")],
  addons: [],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  core: {
    builder: "@storybook/builder-vite",
    disableTelemetry: true,
  },
  features: {
    experimentalRSC: true,
  },
  async viteFinal(config) {
    const { mergeConfig } = await import("vite")
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
    }

    config.esbuild = {
      jsx: "automatic",
    }

    return mergeConfig(config, {
      plugins: [
        svgr({
          svgrOptions: {
            svgo: false,
          },
        }),

        fluentL10n({
          surface: "home-tab",
          locale: "en-US",
          repoRoot: repoRoot,
          sources: ["ui/components/**/component.ftl"],
        }),
      ],
    })
  },
}
export default config
