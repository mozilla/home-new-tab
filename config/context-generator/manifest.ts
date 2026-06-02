/**
 * Source manifest for context generation.
 * Defines what docs feed each output section.
 *
 * mode: "full" — include entire file (after stripping)
 * headers: [...] — extract only sections matching these headers
 *
 * Be selective. The goal is ~300-500 lines total.
 * Each source should contribute only its load-bearing content.
 */

export interface Source {
  file: string
  mode?: "full"
  headers?: string[]
}

export interface Section {
  heading: string
  sources: Source[]
}

export const manifest: Section[] = [
  {
    heading: "System Model",
    sources: [
      {
        file: "architecture/mental-model.md",
        headers: [
          "A system of distinct roles",
          "Build systems as gatekeepers",
          "Runtime as a consumer",
          "Determinism where it matters",
        ],
      },
      {
        file: "architecture/overview.md",
        headers: [
          "The core roles",
          "Coordinator and Renderer responsibilities",
          "Local vs production ownership",
        ],
      },
    ],
  },
  {
    heading: "Contracts",
    sources: [
      {
        file: "spec/snapshot-contract.md",
        headers: [
          "Key properties",
          "What the snapshot includes",
          "Snapshot integrity",
        ],
      },
      {
        file: "spec/lifecycle-contract.md",
        headers: ["The core rule", "Lifecycle methods", "Roles"],
      },
      {
        file: "spec/artifact-model.md",
        headers: [
          "Artifact categories",
          "Required artifacts",
          "Declared vs incidental",
          "Two-channel delivery",
        ],
      },
      {
        file: "spec/identity-model.md",
        headers: [
          "Identity inputs",
          "Key properties",
          "l10nHash as sub-identity",
        ],
      },
      {
        file: "spec/validation-rules.md",
        headers: [
          "Structural validation",
          "Policy validation",
          "Identity validation",
          "Localization validation",
        ],
      },
    ],
  },
  {
    heading: "Gating",
    sources: [
      {
        file: "architecture/gating.md",
        headers: [
          "Validation gates",
          "Exposure gates",
          "The trust invariant",
          "Locale straddles both",
        ],
      },
    ],
  },
  {
    heading: "Subsystems",
    sources: [
      {
        file: "architecture/coordinator.md",
        headers: [
          "Core responsibilities",
          "What the coordinator does not do",
          "SWR behavior",
        ],
      },
      {
        file: "architecture/renderer.md",
        headers: [
          "Core responsibilities",
          "What the renderer does not do",
          "Renderer as a production artifact",
        ],
      },
      {
        file: "architecture/build-system.md",
        headers: [
          "Responsibilities",
          "Layers",
          "What the build system does not do",
        ],
      },
      {
        file: "architecture/l10n.md",
        headers: [
          "Baseline FTL",
          "Two-channel delivery",
          "Identity participation",
          "Validation",
          "Exposure gate",
        ],
      },
      {
        file: "architecture/publish-pipeline.md",
        headers: ["Pipeline stages", "What the pipeline guarantees"],
      },
    ],
  },
  {
    heading: "Glossary",
    sources: [{ file: "spec/glossary.md", mode: "full" }],
  },
  {
    heading: "Status",
    sources: [{ file: "local/tasks.md", mode: "full" }],
  },
]
