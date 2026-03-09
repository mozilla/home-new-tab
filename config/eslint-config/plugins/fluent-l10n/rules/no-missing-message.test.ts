import { describe, afterAll } from "vitest"

import rule from "./no-missing-message.ts"
import { clearFtlCache } from "../utilities/fluent.ts"
import {
  cleanupL10nFixtures,
  makeL10nFixture,
} from "../utilities/test-utils.ts"
import { ruleTester } from "../../rule-tester.ts"

describe("fluent-l10n/no-missing-message", () => {
  afterAll(() => {
    clearFtlCache()
    cleanupL10nFixtures()
  })

  ruleTester.run("fluent-l10n/no-missing-message", rule, {
    valid: [
      {
        name: "accepts a static id that exists in component.ftl",
        ...makeL10nFixture({
          code: `export function Todo() { return <div data-l10n-id="todo-title" /> }`,
          ftl: `todo-title = My Todo List`,
        }),
      },

      {
        name: "skips dynamic data-l10n-id expressions",
        ...makeL10nFixture({
          code: `export function Todo({ id }: { id: string }) { return <div data-l10n-id={id} /> }`,
          ftl: `todo-title = My Todo List`,
        }),
      },

      {
        name: "accepts multiple static ids when all exist in component.ftl",
        ...makeL10nFixture({
          code: `
            export function Todo() {
              return (
                <section>
                  <div data-l10n-id="todo-title" />
                  <p data-l10n-id="todo-description" />
                </section>
              )
            }
          `,
          ftl: `
            todo-title = My Todo List
            todo-description = Keep track of tasks
          `,
        }),
      },
    ],

    invalid: [
      {
        name: "warns when component.ftl is missing",
        ...makeL10nFixture({
          code: `export function Todo() { return <div data-l10n-id="todo-title" /> }`,
        }),
        errors: [
          {
            messageId: "missingComponentFtl",
          },
        ],
      },
      {
        name: "reports a missing static id",
        ...makeL10nFixture({
          code: `export function Todo() { return <div data-l10n-id="missing-id" /> }`,
          ftl: `todo-title = My Todo List`,
        }),
        errors: [
          {
            messageId: "missingMessage",
            data: {
              messageId: "missing-id",
            },
          },
        ],
      },

      {
        name: "reports only the static id that is missing",
        ...makeL10nFixture({
          code: `
            export function Todo() {
              return (
                <section>
                  <div data-l10n-id="todo-title" />
                  <p data-l10n-id="missing-description" />
                </section>
              )
            }
          `,
          ftl: `todo-title = My Todo List`,
        }),
        errors: [
          {
            messageId: "missingMessage",
            data: {
              messageId: "missing-description",
            },
          },
        ],
      },

      {
        name: "reports each missing static id in the file",
        ...makeL10nFixture({
          code: `
            export function Todo() {
              return (
                <>
                  <div data-l10n-id="missing-one" />
                  <div data-l10n-id="missing-two" />
                </>
              )
            }
          `,
          ftl: `todo-title = My Todo List`,
        }),
        errors: [
          {
            messageId: "missingMessage",
            data: {
              messageId: "missing-one",
            },
          },
          {
            messageId: "missingMessage",
            data: {
              messageId: "missing-two",
            },
          },
        ],
      },
      {
        name: "suggests the closest message id when a typo is likely",
        ...makeL10nFixture({
          code: `
      export function Todo() { // intentionally misspelled
        return <div data-l10n-id="todo-descripton" />
      }
    `,
          ftl: `
      todo-title = My Todo List
      todo-description = Keep track of tasks
    `,
        }),
        errors: [
          {
            messageId: "missingMessageSuggestion",
            data: {
              messageId: "todo-descripton",
              suggestion: "todo-description",
            },
          },
        ],
      },

      {
        name: "does not suggest when no close match exists",
        ...makeL10nFixture({
          code: `
      export function Todo() {
        return <div data-l10n-id="completely-random-key" />
      }
    `,
          ftl: `
      todo-title = My Todo List
      todo-description = Keep track of tasks
    `,
        }),
        errors: [
          {
            messageId: "missingMessage",
            data: {
              messageId: "completely-random-key",
            },
          },
        ],
      },
    ],
  })
})
