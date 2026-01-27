import { validateFilename } from "./utilities"
import type { PlopTypes } from "@turbo/gen"

type FeatureAnswers = {
  componentMain: string
  componentSubs: string
  stateName: string
  includeUiHook: boolean
}

export const featurePlop: PlopTypes.PlopGeneratorConfig = {
  description: "Feature (component + state, wired)",
  prompts: async (inquirer) => {
    const { componentMain } = await inquirer.prompt({
      type: "input",
      name: "componentMain",
      message: "What is the component name?",
      validate: validateFilename,
    })

    const { componentSubs } = await inquirer.prompt({
      type: "input",
      name: "componentSubs",
      message:
        "What sub-components would you like? (comma separated, blank for none)",
      validate: (input: string) => {
        if (input.length === 0) return true
        const subs = input.split(",").map((s) => s.trim()).filter(Boolean)
        const validated = subs.map(validateFilename)
        const ok = validated.every((v) => typeof v === "boolean")
        return ok ? true : validated.join(", ")
      },
    })

    const { stateName } = await inquirer.prompt({
      type: "input",
      name: "stateName",
      message: "What is the state domain name?",
      default: componentMain,
      validate: validateFilename,
    })

    const { includeUiHook } = await inquirer.prompt({
      type: "confirm",
      name: "includeUiHook",
      message: "Generate a colocated UI hook for derived display values?",
      default: false,
    })

    return Promise.resolve({
      componentMain,
      componentSubs,
      stateName,
      includeUiHook,
    })
  },

  actions: function (data: FeatureAnswers) {
    const actions: PlopTypes.ActionType[] = []

    // 1) State domain (always)
    actions.push({
      type: "addMany",
      skipIfExists: true,
      destination: "{{ turbo.paths.root }}/data/state/{{ stateName }}/",
      data: {
        stateName: data.stateName,
      },
      templateFiles: ["data-state/index.ts.hbs", "data-state/types.ts.hbs"],
    })

    // 2) Main component (wired to state via template conditionals)
    actions.push({
      type: "addMany",
      skipIfExists: true,
      destination: "{{ turbo.paths.root }}/ui/components/{{ componentName }}/",
      data: {
        componentName: data.componentMain,
        storyName: "Complete",
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

    // 3) Optional colocated hook (next to main component)
    if (data.includeUiHook) {
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

    // 4) Sub-components (no automatic state wiring)
    const subs = data.componentSubs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    for (const sub of subs) {
      const componentName = `${data.componentMain}-${sub}`
      actions.push({
        type: "addMany",
        skipIfExists: true,
        destination: "{{ turbo.paths.root }}/ui/components/{{ componentName }}/",
        data: {
          componentName,
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
