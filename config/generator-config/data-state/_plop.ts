import * as path from "path"

import type { PlopGeneratorConfig } from "plop"
import { validateFilename, REPO_ROOT } from "../utilities"

export const statePlop: PlopGeneratorConfig = {
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
  const dataPath = path.join(REPO_ROOT, "data", "state")
  
  return [
    {
      type: "add",
      skipIfExists: true,
      path: `${dataPath}/{{ stateName }}/index.ts`,
      templateFile: "data-state/index.ts.hbs",
      data: {inlineTypes}
    },
    ...(inlineTypes
      ? []
      : [
          {
            type: "add",
            skipIfExists: true,
            path: `${dataPath}/{{ stateName }}/types.ts`,
            templateFile: "data-state/types.ts.hbs",
          },
        ]),
    {
      type: "add",
      skipIfExists: true,
      path: `${dataPath}/{{ stateName }}/{{ kebabCase stateName }}.test.ts`,
      templateFile: "data-state/state.test.ts.hbs",
    },
  ]
}
}