import * as path from "path"
import * as fs from "fs"

import { resolveComponentFamily, listComponentDirs, requireAnswers, REPO_ROOT } from "../utilities"

import type { Inquirer} from "../utilities"
import type { ActionType, PlopGeneratorConfig } from "plop"

type UIAnswers = {
  componentMain: string
  subs: string[]
  createParentAnyway: boolean
  includeTypes: boolean
}

export const uiPlop: PlopGeneratorConfig = {
  description: "Static UI Component",

  prompts: async (inquirer: Inquirer) => {

    const componentsPath = path.join(REPO_ROOT, "ui", "components")

    const resolved = await resolveComponentFamily(inquirer, {
      componentsPath,
      message: "What is the component name?",
    })

    // Repo-aware plan preview (single confirm at the end)
    const mainComponentPath = path.join(componentsPath, resolved.componentMain)
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

    const { proceed } = await inquirer.prompt<{ proceed: boolean }>({
      type: "confirm",
      name: "proceed",
      message: `Plan:\n${mainLine}\n${subsLine}\n\nProceed?`,
      default: true,
    })

    if (!proceed) throw new Error("Aborted")

    const { includeTypes } = await inquirer.prompt<{ includeTypes: boolean }>({
      type: "confirm",
      name: "includeTypes",
      message: "Export a types.ts file?",
      default: false,
    })

    return {
      componentMain: resolved.componentMain,
      subs: resolved.subs,
      createParentAnyway: resolved.createParentAnyway,
      includeTypes,
    }
  },

  actions: function (answers) {
    const data = requireAnswers(answers as UIAnswers | undefined)
    const actions: ActionType[] = []

    const componentsPath = path.join(process.cwd(), "ui", "components")
    const mainPath = path.join(componentsPath, data.componentMain)

    const mainExists = fs.existsSync(mainPath)

    const allComponents = listComponentDirs(componentsPath)
    const hasSiblings = allComponents.some((name) =>
      name.startsWith(data.componentMain + "-"),
    )

    const shouldCreateMain =
      !mainExists && (!hasSiblings || data.createParentAnyway)

    if (shouldCreateMain) {
      actions.push({
        type: "addMany",
        skipIfExists: true,
        destination: "ui/components/{{ componentName }}/",
        data: {
          componentName: data.componentMain,
          componentMain: data.componentMain,
          storyName: "Overview",
        },
        templateFiles: [
          "ui-component/component.ftl.hbs",
          "ui-component/component.story.tsx.hbs",
          "ui-component/component.test.tsx.hbs",
          "ui-component/index.tsx.hbs",
          "ui-component/style.module.css.hbs",
        ],
      })

      if (data.includeTypes) {
        actions.push({
          type: "add",
          skipIfExists: true,
          path: `ui/components/${data.componentMain}/types.ts`,
          templateFile: "ui-component/types.ts.hbs",
          data: { componentName: data.componentMain },
        })
      }
    }

    for (const sub of data.subs) {
      const componentName = `${data.componentMain}-${sub}`

      actions.push({
        type: "addMany",
        skipIfExists: true,
        destination: "ui/components/{{ componentName }}/",
        data: {
          componentName,
          componentMain: data.componentMain,
          storyName: sub,
        },
        templateFiles: [
          "ui-component/component.ftl.hbs",
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