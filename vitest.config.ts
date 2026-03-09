/// <reference types="vitest" />
import { defineConfig } from "vitest/config"

/**
 * Root Vitest aggregator for the monorepo.
 *
 * Purpose:
 * - Allows the VSCode Vitest extension to discover all package test configs
 * - Does NOT replace package-level configs used by Turbo tasks
 */
export default defineConfig({
  test: {
    projects: ["./**/vitest.config.ts"],
  },
})
