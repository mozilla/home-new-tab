import { resolve } from "node:path"
import { defineConfig } from "vitepress"
// @ts-expect-error — no type declarations available
import taskLists from "markdown-it-task-lists"
import { mermaidRenderer } from "./mermaid"

const isDev = process.env.NODE_ENV !== "production"

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/home-new-tab/",
  title: "Home New Tab",
  description: "Continuous deployment for new tab surfaces",

  // Exclude local-only files from production build
  srcExclude: [
    "readme.md",
    "local/**",
    ...(isDev ? [] : ["meta/charts/**"]),
  ],

  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/welcome" },
      { text: "Architecture", link: "/architecture/overview" },
      { text: "Specifications", link: "/spec/snapshot-contract" },
      { text: "Meta", link: "/meta/contributing" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Welcome", link: "/guide/welcome" },
          { text: "Quick Start", link: "/guide/quick-start" },
          { text: "Repo Structure", link: "/guide/repo-structure" },
          { text: "Code Conventions", link: "/guide/code-conventions" },
          {
            text: "Building Components",
            link: "/guide/building-components",
          },
          { text: "Testing", link: "/guide/testing" },
          { text: "Tooling", link: "/guide/tooling" },
        ],
      },
      {
        text: "Patterns",
        items: [
          {
            text: "State Management",
            link: "/patterns/state-management",
          },
          { text: "Error Handling", link: "/patterns/error-handling" },
          { text: "Metrics", link: "/patterns/metrics" },
        ],
      },
      {
        text: "Architecture",
        items: [
          { text: "Mental Model", link: "/architecture/mental-model" },
          { text: "Overview", link: "/architecture/overview" },
          { text: "Data Flow", link: "/architecture/data-flow" },
          { text: "Gating", link: "/architecture/gating" },
          {
            text: "Subsystems",
            collapsed: true,
            items: [
              { text: "Coordinator", link: "/architecture/coordinator" },
              { text: "Renderer", link: "/architecture/renderer" },
              { text: "Build System", link: "/architecture/build-system" },
              { text: "Feature Flags", link: "/architecture/feature-flags" },
              { text: "Messaging", link: "/architecture/messaging" },
              { text: "L10n", link: "/architecture/l10n" },
              {
                text: "Publish Pipeline",
                link: "/architecture/publish-pipeline",
              },
            ],
          },
        ],
      },
      {
        text: "Specifications",
        collapsed: true,
        items: [
          {
            text: "Contracts",
            items: [
              {
                text: "Snapshot Contract",
                link: "/spec/snapshot-contract",
              },
              {
                text: "Lifecycle Contract",
                link: "/spec/lifecycle-contract",
              },
              { text: "Artifact Model", link: "/spec/artifact-model" },
              { text: "Identity Model", link: "/spec/identity-model" },
              { text: "Validation Rules", link: "/spec/validation-rules" },
            ],
          },
          {
            text: "Reference",
            items: [
              { text: "Glossary", link: "/spec/glossary" },
              { text: "API Surfaces", link: "/spec/api-surfaces" },
              { text: "File Map", link: "/spec/file-map" },
            ],
          },
        ],
      },
      {
        text: "Meta",
        collapsed: true,
        items: [
          { text: "Contributing", link: "/meta/contributing" },
          ...(isDev
            ? [
                {
                  text: "Charts",
                  collapsed: true,
                  items: [
                    {
                      text: "Coordinator Cache Flow",
                      link: "/meta/charts/coordinator-cache-flow",
                    },
                    {
                      text: "Structure Comparison",
                      link: "/meta/charts/structure-comparison",
                    },
                  ],
                },
              ]
            : []),
        ],
      },
    ],

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
    },
    docFooter: {
      prev: "Previous",
      next: "Next",
    },
  },
  markdown: {
    config(md) {
      md.use(taskLists)
      mermaidRenderer(md)
    },
  },
})
