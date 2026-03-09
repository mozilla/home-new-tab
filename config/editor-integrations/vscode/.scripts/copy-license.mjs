import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const extensionRoot = path.resolve(__dirname, "..")
const repoRoot = path.resolve(extensionRoot, "../../../")
const sourceLicensePath = path.join(repoRoot, "LICENSE")
const targetLicensePath = path.join(extensionRoot, "LICENSE")

fs.copyFileSync(sourceLicensePath, targetLicensePath)
console.log(`Copied LICENSE to ${targetLicensePath}`)
