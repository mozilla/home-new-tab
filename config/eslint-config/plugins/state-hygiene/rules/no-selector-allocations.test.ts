import { describe } from "vitest"

import rule from "./no-selector-allocations.js"
import { ruleTester } from "./rule-tester.js"

describe("state-hygiene/no-selector-allocations (smoke)", () => {
  ruleTester.run("no-selector-allocations", rule as any, {
    valid: [
      {
        code: `
          import { useTimer } from "@data/state/timer";
          useTimer(s => s.phase);
        `,
      },
    ],
    invalid: [
      {
        code: `
          import { useTimer } from "@data/state/timer";
          useTimer(s => ({ phase: s.phase }));
        `,
        errors: 1,
      },
    ],
  })
})
