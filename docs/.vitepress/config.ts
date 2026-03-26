import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig } from "vitepress"
// @ts-expect-error — no type declarations available
import taskLists from "markdown-it-task-lists"
import { mermaidRenderer } from "./mermaid"

const isDev = process.env.NODE_ENV !== "production"

/** Build a sidebar group by reading .md files from a docs/audit/ subdirectory. */
function auditGroup(dir: string, label: string) {
  const files = readdirSync(resolve(__dirname, "../audit", dir))
    .filter((f) => f.endsWith(".md"))
    .sort()

  return {
    text: label,
    collapsed: true,
    items: files.map((f) => {
      const slug = f.replace(/\.md$/, "")
      const name = slug.replace(/^\d+[a-z]?-/, "").replace(/-/g, " ")
      return {
        text: name.charAt(0).toUpperCase() + name.slice(1),
        link: `/audit/${dir}/${slug}`,
      }
    }),
  }
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/home-new-tab/",
  title: "Home New Tab",
  description: "Continuous deployment for new tab surfaces",

  // Exclude local-only files from production build
  srcExclude: [
    "readme.md",
    ...(isDev
      ? []
      : [
          "audit/**",
          "meta/tasks.md",
          "meta/agent-context/**",
          "meta/charts/**",
          "meta/lessons/**",
        ]),
  ],

  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/welcome" },
      { text: "Architecture", link: "/architecture/overview" },
      { text: "Specifications", link: "/spec/snapshot-contract" },
      ...(isDev
        ? [
            { text: "Meta", link: "/meta/tasks" },
            { text: "Audit", link: "/audit/README" },
          ]
        : [{ text: "Meta", link: "/meta/contributing" }]),
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
          ...(isDev
            ? [
                { text: "Tasks", link: "/meta/tasks" },
                {
                  text: "Rebuild",
                  collapsed: true,
                  items: [
                    { text: "Overview", link: "/meta/rebuild-tasks" },
                    { text: "Foundations", link: "/meta/rebuild/foundations" },
                    { text: "Coordinator", link: "/meta/rebuild/coordinator" },
                    { text: "Renderer", link: "/meta/rebuild/renderer" },
                  ],
                },
              ]
            : []),
          { text: "Contributing", link: "/meta/contributing" },
          ...(isDev
            ? [
                {
                  text: "Agent Context",
                  collapsed: true,
                  items: [
                    {
                      text: "Readme",
                      link: "/meta/agent-context/readme",
                    },
                    {
                      text: "Documentation",
                      link: "/meta/agent-context/documentation",
                    },
                    {
                      text: "Contracts",
                      link: "/meta/agent-context/contracts",
                    },
                    {
                      text: "L10n Design",
                      link: "/meta/agent-context/l10n-design",
                    },
                  ],
                },
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
      ...(isDev
        ? [
            {
              text: "Audit",
              collapsed: true,
              items: [
                { text: "Overview", link: "/audit/README" },
                auditGroup("foundations", "Foundations"),
                auditGroup("content", "Content Features"),
                auditGroup("ui", "UI Layer"),
                auditGroup("infrastructure", "Infrastructure"),
              ],
            },
          ]
        : []),
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
