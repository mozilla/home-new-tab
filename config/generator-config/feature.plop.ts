import * as path from 'path'
import * as fs from 'fs'
import { validateFilename, detectComponentStructure } from "./utilities"
import type { PlopTypes } from "@turbo/gen"

type FeatureAnswers = {
  componentMain: string
  componentSubs: string
  stateName: string
  includeUiHook: boolean
  createParentAnyway?: boolean
}

export const featurePlop: PlopTypes.PlopGeneratorConfig = {
  description: "Feature (component + state, wired)",
  prompts: async (inquirer) => {
    // First prompt for component name
    const { componentMain: rawInput } = await inquirer.prompt({
      type: "input",
      name: "componentMain",
      message: "What is the component name?",
      validate: validateFilename,
    })

    // Detect component structure
    const componentsPath = path.join(process.cwd(), 'ui', 'components')
    const detected = detectComponentStructure(rawInput, componentsPath)

    let componentMain = rawInput
    let autoDetectedSub = ''

    // If we detected siblings (and no parent), confirm
    if (detected.hasSiblings && !detected.hasParent) {
      const siblingsList = detected.siblings.join(', ')
      const { confirmDetection } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirmDetection',
        message: `Detected "${rawInput}" as a sub-component of "${detected.main}" family (found: ${siblingsList}). Correct?`,
        default: true
      })

      if (confirmDetection) {
        componentMain = detected.main
        autoDetectedSub = detected.sub || ''
      }
    }

    // Create a parent for an existing sibling-only family
    let createParentAnyway = false
    if (!componentMain.includes('-')) {
      // Check if siblings exist
      const allComponents = fs.readdirSync(componentsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.') && !name.startsWith('_'))

      const siblings = allComponents.filter(name => name.startsWith(componentMain + '-'))

      if (siblings.length > 0 && !fs.existsSync(path.join(componentsPath, componentMain))) {
        const siblingsList = siblings.join(', ')
        const { confirmCreateParent } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmCreateParent',
          message: `Found existing siblings (${siblingsList}). Create parent component '${componentMain}' anyway?`,
          default: false
        })
        createParentAnyway = confirmCreateParent
      }
    }

    // Prompt for additional subs (pre-fill with detected sub if any)
    const { componentSubs } = await inquirer.prompt({
      type: "input",
      name: "componentSubs",
      message:
        "What sub-components would you like? (comma separated, blank for none)",
      default: autoDetectedSub,
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
      createParentAnyway,
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

    // Check if this is a sibling-only family (siblings exist but no parent)
    const componentsPath = path.join(process.cwd(), 'ui', 'components')
    const mainComponentPath = path.join(componentsPath, data.componentMain)
    const mainExists = fs.existsSync(mainComponentPath)

    // Check if siblings exist for this component family by looking for any folder that starts with componentMain-
    let hasSiblings = false
    if (fs.existsSync(componentsPath)) {
      const allComponents = fs.readdirSync(componentsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.') && !name.startsWith('_'))

      hasSiblings = allComponents.some(name => name.startsWith(data.componentMain + '-'))
    }

    // 2) Main component (only if it doesn't exist AND (no siblings exist OR we confirmed to create parent anyway))
    if (!mainExists && (!hasSiblings || data.createParentAnyway)) {
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

      // 3) Optional colocated hook (only if main component is created)
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
