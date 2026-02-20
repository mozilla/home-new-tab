import * as path from "path"
import * as fs from "fs"

import { resolveComponentFamily, listComponentDirs } from "../utilities"
import type { PlopTypes } from "@turbo/gen"

type Inquirer = PlopTypes.NodePlopAPI["inquirer"]

type UIAnswers = {
  componentMain: string
  subs: string[]
  createParentAnyway: boolean
}

export const uiPlop: PlopTypes.PlopGeneratorConfig = {
  description: "Static UI Component",

  prompts: async (inquirer: Inquirer) => {
    const componentsPath = path.join(process.cwd(), "ui", "components")

    const resolved = await resolveComponentFamily(inquirer, {
      componentsPath,
      message: "What is the component name?",
    })

    return {
      componentMain: resolved.componentMain,
      subs: resolved.subs,
      createParentAnyway: resolved.createParentAnyway,
    }
  },

  actions: function (data: UIAnswers) {
    const actions: PlopTypes.ActionType[] = []

    const componentsPath = path.join(process.cwd(), "ui", "components")
    const mainPath = path.join(componentsPath, data.componentMain)

    const mainExists = fs.existsSync(mainPath)

    const allComponents = listComponentDirs(componentsPath)
    const hasSiblings = allComponents.some((name) =>
      name.startsWith(data.componentMain + "-"),
    )

    if (!mainExists && (!hasSiblings || data.createParentAnyway)) {
      actions.push({
        type: "addMany",
        skipIfExists: true,
        destination:
          "{{ turbo.paths.root }}/ui/components/{{ componentName }}/",
        data: {
          componentName: data.componentMain,
          storyName: "Complete",
        },
        templateFiles: [
          "ui-component/component.story.tsx.hbs",
          "ui-component/component.test.tsx.hbs",
          "ui-component/index.tsx.hbs",
          "ui-component/style.module.css.hbs",
        ],
      })
    }

    for (const sub of data.subs) {
      const componentName = `${data.componentMain}-${sub}`

      actions.push({
        type: "addMany",
        skipIfExists: true,
        destination:
          "{{ turbo.paths.root }}/ui/components/{{ componentName }}/",
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