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
    // Core domain files
    {
      type: "addMany",
      skipIfExists: true,
      destination: "{{ turbo.paths.root }}/data/state/{{ stateName }}/",
      templateFiles: [
        "data-state/index.ts.hbs",
        "data-state/types.ts.hbs",
      ],
    },

    // Optional React hook (UI-facing)
    {
      type: "add",
      skipIfExists: true,
      path: "{{ turbo.paths.root }}/ui/hooks/use{{pascalCase stateName}}Display.ts",
      templateFile: "data-state/hook.ts.hbs",
      skip: (data: { includeUiHook?: boolean }) =>
        data.includeUiHook ? false : "Skipping UI hook",
    },
  ],
}