import { validateFilename } from "../utilities"

export const statePlop = {
  description: "Shared state for components",
  prompts: [
    {
      type: "input",
      name: "stateName",
      message: "What is the name of the state you would like?",
      validate: validateFilename,
    },
  ],
  actions: [
    {
      type: "addMany",
      skipIfExists: true,
      destination: "{{ turbo.paths.root }}/data/state/{{ stateName }}/",
      templateFiles: ["data-state/index.ts.hbs"],
    },
  ],
}
