import type { PlopTypes } from "@turbo/gen"

import { validateFilename } from "../utilities"

export const statePlop: PlopTypes.PlopGeneratorConfig = {
  description: "Shared state domain (no UI)",
  prompts: [
    {
      type: "input",
      name: "stateName",
      message: "What is the state domain name?",
      validate: validateFilename,
    },
    {
      type: "confirm",
      name: "inlineTypes",
      message: "Inline types in index.ts?",
      default: true,
    },
  ],
  actions: (answers) => {
  const inlineTypes = Boolean((answers as any)?.inlineTypes)

  return [
    {
      type: "add",
      skipIfExists: true,
      path: "{{ turbo.paths.root }}/data/state/{{ stateName }}/index.ts",
      templateFile: "data-state/index.ts.hbs",
      data: {inlineTypes}
    },
    ...(inlineTypes
      ? []
      : [
          {
            type: "add",
            skipIfExists: true,
            path: "{{ turbo.paths.root }}/data/state/{{ stateName }}/types.ts",
            templateFile: "data-state/types.ts.hbs",
          },
        ]),
    {
      type: "add",
      skipIfExists: true,
      path: "{{ turbo.paths.root }}/data/state/{{ stateName }}/{{ kebabCase stateName }}.test.ts",
      templateFile: "data-state/state.test.ts.hbs",
    },
  ]
}
}