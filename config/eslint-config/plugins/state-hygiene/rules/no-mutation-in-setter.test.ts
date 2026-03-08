import { describe } from "vitest"
import rule from "./no-mutation-in-setter.ts"
import { ruleTester } from "../../rule-tester.ts"

describe("state-hygiene/no-mutation-in-setter (smoke)", () => {
  ruleTester.run("no-mutation-in-setter", rule as any, {
    valid: [
      {
        code: `
          set(state => ({ phase: "break" }));
        `,
      },
    ],
    invalid: [
      {
        code: `
          set(state => {
            state.phase = "break";
          });
        `,
        errors: 1,
      },
    ],
  })
})
