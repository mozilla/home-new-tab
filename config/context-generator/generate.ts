/**
 * Context generator — compiles human-readable docs into a dense,
 * LLM-optimized context file.
 *
 * Usage: pnpm gen:context
 * Output: docs/meta/CONTEXT.md
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { manifest } from "./manifest.ts"
import { strip, extractSections } from "./strip.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsRoot = resolve(__dirname, "../../docs")
const outputPath = resolve(docsRoot, "local/CONTEXT.md")

function readSource(file: string): string {
  const fullPath = resolve(docsRoot, file)
  if (!existsSync(fullPath)) {
    console.warn(`  ⚠ Missing: ${file}`)
    return ""
  }
  return readFileSync(fullPath, "utf-8")
}

function processSource(file: string, mode?: "full", headers?: string[]): string {
  const raw = readSource(file)
  if (!raw) return ""

  if (headers?.length) {
    const extracted = extractSections(raw, headers)
    return strip(extracted)
  }

  return strip(raw)
}

function generate(): string {
  const timestamp = new Date().toISOString().split("T")[0]
  const parts: string[] = []

  parts.push(`# System Context

> Auto-generated from docs/. Do not edit directly.
> Regenerate: \`pnpm gen:context\`
> Last generated: ${timestamp}`)

  for (const section of manifest) {
    parts.push(`\n## ${section.heading}\n`)

    for (const source of section.sources) {
      const content = processSource(source.file, source.mode, source.headers)
      if (content) {
        parts.push(content)
        parts.push("") // spacing between sources
      }
    }
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}

// Run
console.log("Generating context from docs/...")
const output = generate()
writeFileSync(outputPath, output, "utf-8")

const lines = output.split("\n").length
console.log(`  → ${outputPath}`)
console.log(`  → ${lines} lines`)
