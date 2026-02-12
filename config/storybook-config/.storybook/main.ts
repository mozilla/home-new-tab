import type { StorybookConfig } from "@storybook/react-vite"
import svgr from "vite-plugin-svgr"

import { createRequire } from "node:module"
import { join, dirname, resolve } from "path"

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
    const { mergeConfig, loadEnv } = await import("vite")

    // Load environment variables from project root (supports .env, .env.local)
    const configDir = dirname(new URL(import.meta.url).pathname)
    const projectRoot = resolve(configDir, rootDirectory)
    const mode = process.env.NODE_ENV || "development"
    const env = loadEnv(mode, projectRoot, "VITE_")

    // Convert env vars to define format for injection
    const envDefines = Object.entries(env).reduce(
      (acc, [key, value]) => {
        acc[`import.meta.env.${key}`] = JSON.stringify(value)
        return acc
      },
      {} as Record<string, string>,
    )

    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
    }

    config.esbuild = {
      jsx: "automatic",
    }

    return mergeConfig(config, {
      define: envDefines,
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
