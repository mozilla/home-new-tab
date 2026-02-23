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
  ],
  actions: [
    {
      type: "addMany",
      skipIfExists: true,
      destination: "{{ turbo.paths.root }}/data/state/{{ stateName }}/",
      templateFiles: ["data-state/index.ts.hbs", "data-state/types.ts.hbs"],
    },
    {
      type: "add",
      skipIfExists: true,
      path: "{{ turbo.paths.root }}/data/state/{{ stateName }}/{{ kebabCase stateName }}.test.ts",
      templateFile: "data-state/state.test.ts.hbs",
    },
  ],
}