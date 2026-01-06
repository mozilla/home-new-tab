import type { StorybookConfig } from "@storybook/react-vite"
import svgr from "vite-plugin-svgr"

import { createRequire } from "node:module"
import { join, dirname } from "path"

// Silliness due to ESM vs Common in the node ecosystem
// !! Check for removal when node version is bumped (current 23)
const require = createRequire(import.meta.url)

const rootDirectory = "../../../"

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")))
}
const config: StorybookConfig = {
  stories: [join(dirname("."), rootDirectory, "ui/components/**/*.story.tsx")],
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
      ],
    })
  },
}
export default config
