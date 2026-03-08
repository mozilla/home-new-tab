import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, afterAll } from "vitest"

import rule from "./no-missing-message.ts"
import { clearFtlCache } from "../utilities/fluent.ts"
import {
  cleanupL10nFixtures,
  makeL10nFixture,
} from "../utilities/test-utils.ts"
import { ruleTester } from "../../rule-tester.ts"

function makeFixture(args: { code: string; ftl?: string; fileName?: string }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluent-l10n-"))
  const filePath = path.join(dir, args.fileName ?? "todo.tsx")

  fs.writeFileSync(filePath, args.code, "utf8")

  if (typeof args.ftl === "string") {
    fs.writeFileSync(path.join(dir, "component.ftl"), args.ftl, "utf8")
  }

  return filePath
}

describe("fluent-l10n/no-missing-message", () => {
  afterAll(() => {
    clearFtlCache()
    cleanupL10nFixtures()
  })

  ruleTester.run("fluent-l10n/no-missing-message", rule, {
    valid: [
      makeL10nFixture({
        code: `export function Todo() { return <div data-l10n-id="todo-title" /> }`,
        ftl: `todo-title = My Todo List`,
      }),

      makeL10nFixture({
        code: `export function Todo() { return <div data-l10n-id="todo-title" /> }`,
      }),

      makeL10nFixture({
        code: `export function Todo({ id }: { id: string }) { return <div data-l10n-id={id} /> }`,
        ftl: `todo-title = My Todo List`,
      }),

      makeL10nFixture({
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
    ],

    invalid: [
      {
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
    ],
  })
})
