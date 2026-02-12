/// <reference types="vitest" />
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  define: {
    "import.meta.env.VITE_CLOUDINARY_CLOUD_NAME":
      JSON.stringify("test-cloud-name"),
  },
})
