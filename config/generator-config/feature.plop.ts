import * as path from "path"
import * as fs from "fs"

import {
  resolveComponentFamily,
  validateFilename,
  listComponentDirs,
  requireAnswers
} from "./utilities"

import type { Inquirer } from "./utilities"
import type { PlopTypes } from "@turbo/gen"

type FeatureAnswers = {
  componentMain: string
  subs: string[]
  stateName: string
  includeUiHook: boolean
  createParentAnyway: boolean
}

export const featurePlop: PlopTypes.PlopGeneratorConfig = {
  description: "Feature (component + state, wired)",

  prompts: async (inquirer: Inquirer) => {
    const repoRoot = process.cwd()
    const componentsPath = path.join(repoRoot, "ui", "components")

    const resolved = await resolveComponentFamily(inquirer, { componentsPath })

    const { stateName } = await inquirer.prompt({
      type: "input",
      name: "stateName",
      message: "What is the state domain name?",
      default: resolved.componentMain,
      validate: validateFilename,
    })

    const { includeUiHook } = await inquirer.prompt<{ includeUiHook: boolean }>({
      type: "list",
      name: "includeUiHook",
      message: "Generate a colocated UI hook for derived display values?",
      choices: [
        { name: "No", value: false },
        { name: "Yes", value: true },
      ],
      default: false,
    })

    // Repo-aware plan preview (short + honest)
    const statePath = path.join(repoRoot, "data", "state", stateName)
    const mainComponentPath = path.join(componentsPath, resolved.componentMain)

    const stateExists = fs.existsSync(statePath)
    const mainExists = fs.existsSync(mainComponentPath)

    const allComponents = listComponentDirs(componentsPath)
    const hasSiblings = allComponents.some((name) =>
      name.startsWith(resolved.componentMain + "-"),
    )

    const willGenerateMain =
      !mainExists && (!hasSiblings || resolved.createParentAnyway)

    const existingSubs = resolved.subs.filter((sub) =>
      fs.existsSync(path.join(componentsPath, `${resolved.componentMain}-${sub}`)),
    )

    const stateLine = stateExists
      ? `State: ${stateName} (exists → will skip)`
      : `State: ${stateName} (will generate)`

    const mainLine = willGenerateMain
      ? `UI component: ${resolved.componentMain} (will generate)`
      : mainExists
        ? `UI component: ${resolved.componentMain} (exists → will skip)`
        : `UI component: ${resolved.componentMain} (siblings exist → will skip)`

    const subsLine =
      resolved.subs.length === 0
        ? "Sub-components: (none)"
        : existingSubs.length === 0
          ? `Sub-components: ${resolved.subs.join(", ")} (will generate)`
          : `Sub-components: ${resolved.subs.join(", ")} (will generate; skipping existing: ${existingSubs.join(
              ", ",
            )})`

    const hookLine = includeUiHook
      ? "Colocated UI hook: yes (if the main component exists or is generated)"
      : "Colocated UI hook: no"
      
    const { proceed } = await inquirer.prompt<{ proceed: boolean }>({
      type: "confirm",
      name: "proceed",
      message: `Plan:\n${stateLine}\n${mainLine}\n${subsLine}\n${hookLine}\n\nProceed?`,
      default: true,
    })

    if (!proceed) throw new Error("Aborted")

    return {
      componentMain: resolved.componentMain,
      subs: resolved.subs,
      createParentAnyway: resolved.createParentAnyway,
      stateName,
      includeUiHook,
    }
  },

  actions: function (answers) {
    const data = requireAnswers(answers as FeatureAnswers | undefined)
    const actions: PlopTypes.ActionType[] = []

    actions.push({
      type: "addMany",
      skipIfExists: true,
      destination: "{{ turbo.paths.root }}/data/state/{{ stateName }}/",
      data: { stateName: data.stateName, includeState: true},
      templateFiles: ["data-state/index.ts.hbs", "data-state/types.ts.hbs"],
    })

    const componentsPath = path.join(process.cwd(), "ui", "components")
    const mainPath = path.join(componentsPath, data.componentMain)

    const mainExists = fs.existsSync(mainPath)

    const allComponents = listComponentDirs(componentsPath)
    const hasSiblings = allComponents.some((name) =>
      name.startsWith(data.componentMain + "-"),
    )

    const shouldCreateMain =
      !mainExists && (!hasSiblings || data.createParentAnyway)

    const canWriteHook = mainExists || shouldCreateMain

    if (shouldCreateMain) {
      actions.push({
        type: "addMany",
        skipIfExists: true,
        destination: "{{ turbo.paths.root }}/ui/components/{{ componentName }}/",
        data: {
          componentName: data.componentMain,
          componentMain: data.componentMain,
          storyName: "Overview",
          stateName: data.stateName,
          includeUiHook: data.includeUiHook,
          includeState: true,
        },
        templateFiles: [
          "ui-component/component.story.tsx.hbs",
          "ui-component/component.test.tsx.hbs",
          "ui-component/index.tsx.hbs",
          "ui-component/style.module.css.hbs",
        ],
      })
    }

    if (data.includeUiHook && canWriteHook) {
      actions.push({
        type: "add",
        skipIfExists: true,
        path:
          "{{ turbo.paths.root }}/ui/components/{{ componentName }}/use{{pascalCase componentName}}Display.ts",
        data: {
          componentName: data.componentMain,
          stateName: data.stateName,
        },
        templateFile: "ui-component/hook.ts.hbs",
      })
    }

    for (const sub of data.subs) {
      const componentName = `${data.componentMain}-${sub}`

      actions.push({
        type: "addMany",
        skipIfExists: true,
        destination: "{{ turbo.paths.root }}/ui/components/{{ componentName }}/",
        data: {
          componentName,
          componentMain: data.componentMain,
          storyName: sub,
        },
        templateFiles: [
          "ui-component/component.story.tsx.hbs",
          "ui-component/component.test.tsx.hbs",
          "ui-component/index.tsx.hbs",
          "ui-component/style.module.css.hbs",
        ],
      })
    }

    return actions
  },
}