import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

import type { UserConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5001,
    proxy: {
      "/api": {
        target: "http://localhost:3009",
        changeOrigin: true,
      },
    },
  },
}) satisfies UserConfig
