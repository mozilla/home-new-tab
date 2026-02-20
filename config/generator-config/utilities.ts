import * as fs from "fs"
import * as path from "path"
import type { PlopTypes } from "@turbo/gen"

type Inquirer = PlopTypes.NodePlopAPI["inquirer"]

type ResolveResult = {
  componentMain: string
  subs: string[]
  createParentAnyway: boolean
}

export interface ComponentStructure {
  main: string
  sub: string | null
  hasSiblings: boolean
  hasParent: boolean
  siblings: string[]
}

/**
 * normalizeCsvNames
 * ---
 * Make sure we aren't doubling things up icon, icon, icon
 */
export function normalizeCsvNames(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  )
}

/**
 * listComponentDirs
 * ---
 * Returns folder names under `componentsPath`, excluding:
 * - dot folders (.)
 * - private folders (_)
 */
export function listComponentDirs(componentsPath: string): string[] {
  if (!fs.existsSync(componentsPath)) return []

  return fs
    .readdirSync(componentsPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith(".") && !name.startsWith("_"))
}

/**
 * detectComponentStructure
 * ---
 * Interprets an input like:
 * - "button"       -> main="button", sub=null
 * - "button-icon"  -> main="button", sub="icon"
 *
 * Also detects whether:
 * - the parent folder exists (e.g. ui/components/button/)
 * - there are sibling folders (e.g. ui/components/button-*), excluding the input folder itself
 */
export function detectComponentStructure(
  input: string,
  componentsPath: string,
): ComponentStructure {
  // If no hyphen, it's a main component
  if (!input.includes("-")) {
    return {
      main: input,
      sub: null,
      hasSiblings: false,
      hasParent: fs.existsSync(path.join(componentsPath, input)),
      siblings: [],
    }
  }

  // Split on first hyphen only
  const firstHyphenIndex = input.indexOf("-")
  const prefix = input.substring(0, firstHyphenIndex)
  const suffix = input.substring(firstHyphenIndex + 1)

  const parentPath = path.join(componentsPath, prefix)
  const hasParent =
    fs.existsSync(parentPath) && fs.statSync(parentPath).isDirectory()

  const allComponents = listComponentDirs(componentsPath)

  // Find siblings with same prefix (excluding current input)
  const siblings = allComponents.filter(
    (name) => name !== input && name.startsWith(prefix + "-"),
  )

  return {
    main: prefix,
    sub: suffix,
    hasSiblings: siblings.length > 0,
    hasParent,
    siblings,
  }
}

/**
 * validateFilename
 * ---
 * Enforces predictable folder names.
 *
 * Allowed:
 * - kebab-case segments: "menu", "menu-item", "menu-item-2"
 *
 * Disallowed:
 * - empty
 * - underscores, spaces, dots, slashes
 * - uppercase letters
 * - leading/trailing hyphen, double hyphens
 */
export function validateFilename(input: string) {
  if (!input) return "name is required"

  const value = input.trim()
  if (value !== input) return "name cannot start or end with spaces"

  // kebab-case: letters/digits with single hyphens between segments
  // examples: "button", "button-icon", "button-2", "button-icon-2"
  const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!kebabCase.test(value)) {
    return "use kebab-case (lowercase letters/numbers, hyphens only)"
  }

  return true
}


/**
 * resolveComponentFamily
 * ---
 * Shared UX for component generators.
 *
 * Design goals:
 * - be explicit when input is ambiguous (kebab-case with hyphen)
 * - avoid "auto-filled surprises" by asking before adding detected subs
 * - keep prompts short, but confirm the plan before generating
 */
export async function resolveComponentFamily(
  inquirer: Inquirer,
  args: {
    componentsPath: string
    message?: string
  },
): Promise<ResolveResult> {
  const { componentsPath, message = "What is the component name?" } = args

  const { componentInput } = await inquirer.prompt<{
    componentInput: string
  }>({
    type: "input",
    name: "componentInput",
    message,
    validate: validateFilename,
  })

  const detected = detectComponentStructure(componentInput, componentsPath)

  // Start with a conservative default: treat the input as the main component.
  let componentMain = componentInput
  let suggestedSub: string | null = null

  // If input includes "-" it might be:
  // - a main component with hyphenated name (e.g. "menu-overflow")
  // - OR a sub component under a family (e.g. "menu-overflow" => menu + overflow)
  if (componentInput.includes("-")) {
    const interpretationChoices = [
      {
        name: `Treat "${componentInput}" as the main component name`,
        value: "as-main",
      },
      {
        name: `Treat it as a sub-component: main "${detected.main}", sub "${detected.sub}"`,
        value: "as-sub",
      },
    ] as const

    const { interpretation } = await inquirer.prompt<{
      interpretation: (typeof interpretationChoices)[number]["value"]
    }>({
      type: "list",
      name: "interpretation",
      message: `How should we interpret "${componentInput}"?`,
      choices: interpretationChoices,
      default: "as-main",
    })

    if (interpretation === "as-sub") {
      componentMain = detected.main
      suggestedSub = detected.sub
    }
  }

  // If we detected a sibling-only family (siblings exist, parent missing),
  // confirm whether to create the parent.
  let createParentAnyway = false
  if (!componentMain.includes("-")) {
    const allComponents = listComponentDirs(componentsPath)
    const siblings = allComponents.filter((name) =>
      name.startsWith(componentMain + "-"),
    )
    const mainPath = path.join(componentsPath, componentMain)

    if (siblings.length > 0 && !fs.existsSync(mainPath)) {
      const siblingsList = siblings.join(", ")

      const { parentPlan } = await inquirer.prompt<{
        parentPlan: "skip-parent" | "create-parent"
      }>({
        type: "list",
        name: "parentPlan",
        message: `Found existing siblings (${siblingsList}), but no parent "${componentMain}". What should we do?`,
        choices: [
          { name: "Skip parent (generate only sub-components)", value: "skip-parent" },
          { name: `Create parent "${componentMain}" too`, value: "create-parent" },
        ],
        default: "skip-parent",
      })

      createParentAnyway = parentPlan === "create-parent"
    }
  }

  // Build up subs intentionally (avoid surprise defaults).
  const subs: string[] = []

  if (suggestedSub) {
    const { includeSuggested } = await inquirer.prompt<{
      includeSuggested: boolean
    }>({
      type: "confirm",
      name: "includeSuggested",
      message: `Add detected sub-component "${suggestedSub}"?`,
      default: true,
    })

    if (includeSuggested) subs.push(suggestedSub)
  }

  const { extraSubsRaw } = await inquirer.prompt<{
    extraSubsRaw: string
  }>({
    type: "input",
    name: "extraSubsRaw",
    message:
      subs.length > 0
        ? "Any additional sub-components? (comma separated, blank for none)"
        : "What sub-components would you like? (comma separated, blank for none)",
    validate: (input: string) => {
      if (input.length === 0) return true

      const extra = normalizeCsvNames(input)
      const validated = extra.map(validateFilename)
      const ok = validated.every((v) => typeof v === "boolean")
      return ok ? true : validated.join(", ")
    },
  })

  subs.push(...normalizeCsvNames(extraSubsRaw))

  const normalizedSubs = Array.from(new Set(subs))

  // Final plan review (confidence boost)
  const planLines = [
    `Main component: ${componentMain}`,
    `Sub-components: ${normalizedSubs.length ? normalizedSubs.join(", ") : "(none)"}`,
  ].join("\n")

  const { proceed } = await inquirer.prompt<{ proceed: boolean }>({
    type: "confirm",
    name: "proceed",
    message: `Generate:\n${planLines}\n\nProceed?`,
    default: true,
  })

  if (!proceed) {
    // Plop convention: throwing aborts the generator cleanly
    throw new Error("Aborted")
  }

  return {
    componentMain,
    subs: normalizedSubs,
    createParentAnyway,
  }
}