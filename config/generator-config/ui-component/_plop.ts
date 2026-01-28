import * as path from 'path'
import * as fs from 'fs'
import { validateFilename, detectComponentStructure } from '../utilities'
import type { PlopTypes } from '@turbo/gen'

type UIAnswers = {
  componentMain: string
  componentSubs: string
  createParentAnyway?: boolean
}

export const uiPlop: PlopTypes.PlopGeneratorConfig = {
  description: 'Static UI Component',
  prompts: async (inquirer) => {
    // First prompt for component name
    const { componentMain: rawInput } = await inquirer.prompt({
      type: 'input',
      name: 'componentMain',
      message: 'What is the component type?',
      validate: validateFilename
    })

    // Detect component structure
    const componentsPath = path.join(process.cwd(), 'ui', 'components')
    const detected = detectComponentStructure(rawInput, componentsPath)

    let componentMain = rawInput
    let autoDetectedSub = ''

    // If we detected siblings (and no parent), confirm what behavior we want
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
      type: 'input',
      name: 'componentSubs',
      message: 'What sub-components would you like? (comma separated, blank for none)',
      default: autoDetectedSub,
      validate: (input: string) => {
        if (input.length == 0) return true
        const subs = input.split(',').map((stringValue) => stringValue.toString().trim())
        const validatedValues = subs.map(validateFilename)
        const hasNoErrors = validatedValues.every(
          (currentValue) => typeof currentValue === 'boolean'
        )
        return hasNoErrors ? true : validatedValues.join(', ')
      }
    })

    return Promise.resolve({
      componentSubs,
      componentMain,
      createParentAnyway
    })
  },
  actions: function (data: UIAnswers) {
    const { componentMain, componentSubs, createParentAnyway } = data
    const actions: PlopTypes.ActionType[] = []

    // Check if this is a sibling-only family (siblings exist but no parent)
    const componentsPath = path.join(process.cwd(), 'ui', 'components')
    const mainComponentPath = path.join(componentsPath, componentMain)
    const mainExists = fs.existsSync(mainComponentPath)

    // Check if siblings exist for this component family by looking for any folder that starts with componentMain-
    let hasSiblings = false
    if (fs.existsSync(componentsPath)) {
      const allComponents = fs.readdirSync(componentsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.') && !name.startsWith('_'))

      hasSiblings = allComponents.some(name => name.startsWith(componentMain + '-'))
    }

    // Only add main if it doesn't exist AND (no siblings exist OR user confirmed to create parent anyway)
    if (!mainExists && (!hasSiblings || createParentAnyway)) {
      const addMain = {
        type: 'addMany',
        skipIfExists: true,
        destination: '{{ turbo.paths.root }}/ui/components/{{ componentName }}/',
        data: {
          componentName: componentMain,
          storyName: 'Complete'
        },
        templateFiles: [
          'ui-component/component.story.tsx.hbs',
          'ui-component/component.test.tsx.hbs',
          'ui-component/index.tsx.hbs',
          'ui-component/style.module.css.hbs'
        ]
      }
      actions.push(addMain)
    }

    // Add sub-components
    const subs = componentSubs
      .split(',')
      .filter(Boolean)
      .map((subName) => {
        const componentName = `${componentMain}-${subName.trim()}`
        return {
          type: 'addMany',
          destination: '{{ turbo.paths.root }}/ui/components/{{ componentName }}/',
          data: {
            componentName,
            storyName: subName.trim()
          },
          templateFiles: [
            'ui-component/component.story.tsx.hbs',
            'ui-component/component.test.tsx.hbs',
            'ui-component/index.tsx.hbs',
            'ui-component/style.module.css.hbs'
          ]
        }
      })

    return [...actions, ...subs]
  }
}
