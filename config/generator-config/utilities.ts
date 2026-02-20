import * as fs from "fs"
import * as path from "path"

export type Inquirer = {
  prompt: <T = any>(questions: any) => Promise<T>
}

export function requireAnswers<T>(data: T | undefined): T {
  if (!data) throw new Error("Missing generator answers (did the prompt phase abort?)")
  return data
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
): Promise<{
  componentMain: string
  subs: string[]
  createParentAnyway: boolean
}> {
  const { componentsPath, message = "What is the component name?" } = args

  const { componentInput } = await inquirer.prompt<{ componentInput: string }>({
    type: "input",
    name: "componentInput",
    message,
    validate: validateFilename,
  })

  const detected = detectComponentStructure(componentInput, componentsPath)

  // Default: treat input as the main component name
  let componentMain = componentInput
  let impliedSub: string | null = null

  // If input includes '-', it can be ambiguous:
  // - main component "menu-overflow"
  // - or family main "menu" + sub "overflow"
  if (componentInput.includes("-")) {
    const { interpretation } = await inquirer.prompt<{
      interpretation: "as-main" | "as-sub"
    }>({
      type: "list",
      name: "interpretation",
      message: `Interpret "${componentInput}" as…`,
      choices: [
        { name: `Main component: "${componentInput}"`, value: "as-main" },
        {
          name: `Sub-component: main "${detected.main}" + sub "${detected.sub}"`,
          value: "as-sub",
        },
      ],
      default: "as-main",
    })

    if (interpretation === "as-sub") {
      componentMain = detected.main
      impliedSub = detected.sub
    }
  }

  // If siblings exist but parent is missing, pick behavior via list (not confirm)
  let createParentAnyway = false
  if (!componentMain.includes("-")) {
    const allComponents = listComponentDirs(componentsPath)
    const siblings = allComponents.filter((name) =>
      name.startsWith(componentMain + "-"),
    )

    const mainPath = path.join(componentsPath, componentMain)
    const parentMissing = siblings.length > 0 && !fs.existsSync(mainPath)

    if (parentMissing) {
      const { parentPlan } = await inquirer.prompt<{
        parentPlan: "skip-parent" | "create-parent"
      }>({
        type: "list",
        name: "parentPlan",
        message: `Siblings exist but parent "${componentMain}" is missing. Generate parent too?`,
        choices: [
          { name: "Skip parent (generate only sub-components)", value: "skip-parent" },
          { name: `Generate parent "${componentMain}" too`, value: "create-parent" },
        ],
        default: "skip-parent",
      })

      createParentAnyway = parentPlan === "create-parent"
    }
  }

  // Sub-components prompt (single input). If we implied a sub, we pre-seed it in the input
  // so the user can delete/replace it—no extra confirms.
  const { componentSubs } = await inquirer.prompt<{ componentSubs: string }>({
    type: "input",
    name: "componentSubs",
    message: "Sub-components (comma separated, blank for none)",
    default: impliedSub ?? "",
    validate: (input: string) => {
      if (input.length === 0) return true

      const subs = normalizeCsvNames(input)
      const validated = subs.map(validateFilename)
      const ok = validated.every((v) => typeof v === "boolean")
      return ok ? true : validated.join(", ")
    },
  })

  return {
    componentMain,
    subs: normalizeCsvNames(componentSubs),
    createParentAnyway,
  }
}