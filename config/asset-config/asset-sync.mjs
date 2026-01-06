#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import os from "node:os"
import { execFileSync } from "node:child_process"

const MANIFEST_NAME = "asset.manifest.json"

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${file}\n${e?.message ?? e}`)
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true })
}

function readMarker(markerPath) {
  try {
    return JSON.parse(fs.readFileSync(markerPath, "utf8"))
  } catch {
    return null
  }
}

function writeMarker(markerPath, marker) {
  ensureDir(path.dirname(markerPath))
  fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n")
}

function resolveOutDir(manifestDir, outDir) {
  return path.isAbsolute(outDir) ? outDir : path.resolve(manifestDir, outDir)
}

function fileExists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function runGit(args, cwd) {
  // Use execFileSync to avoid shell quoting issues
  execFileSync("git", args, { cwd, stdio: "inherit" })
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function withTimeout(promise, ms, label) {
  let t
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(t)
  }
}

async function retry(fn, { attempts = 3, baseDelayMs = 750 } = {}) {
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i)
    } catch (e) {
      lastErr = e
      console.warn(
        `[asset-sync] attempt ${i}/${attempts} failed: ${String(e?.message ?? e)}`,
      )
      if (i < attempts) {
        const delay = baseDelayMs * Math.pow(2, i - 1)
        console.warn(`[asset-sync] retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  throw lastErr
}

function cpDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true })
}

// Keep the clone work synchronous (git is sync anyway) but wrapped for timeout/retry.
async function gitSparseExport({ repo, subdir, ref }, tmpDir) {
  const repoDir = path.join(tmpDir, "repo")
  ensureDir(repoDir)

  // Init repo without checkout
  runGit(["init"], repoDir)
  runGit(["remote", "add", "origin", repo], repoDir)

  // Sparse checkout setup (cone mode works best for directories)
  runGit(["sparse-checkout", "init", "--cone"], repoDir)
  runGit(["sparse-checkout", "set", subdir], repoDir)

  // Fetch only what we need. Using depth=1 keeps it light; if ref is "weird", remove depth.
  runGit(["fetch", "--depth=1", "origin", ref], repoDir)
  runGit(["checkout", "--detach", "FETCH_HEAD"], repoDir)

  const exportedPath = path.join(repoDir, subdir)
  if (!fileExists(exportedPath)) {
    throw new Error(`Subdir not found after checkout: ${subdir}`)
  }
  return exportedPath
}

async function syncOne(entry, manifestDir) {
  const { name, repo, subdir, ref, outDir } = entry
  if (!repo || !subdir || !ref || !outDir) {
    throw new Error(
      `Invalid manifest entry${name ? ` "${name}"` : ""}: requires repo, subdir, ref, outDir`,
    )
  }

  const absOutDir = resolveOutDir(manifestDir, outDir)
  const markerPath = path.join(absOutDir, ".pin.json")
  const desired = { repo, subdir, ref }

  const existing = readMarker(markerPath)
  const outDirExists = fs.existsSync(absOutDir)

  if (
    outDirExists &&
    existing?.repo === repo &&
    existing?.subdir === subdir &&
    existing?.ref === ref
  ) {
    console.log(`[asset-sync] ${name ?? absOutDir}: already pinned — skipping`)
    return
  }

  console.log(
    `[asset-sync] ${name ?? absOutDir}: syncing ${repo}@${ref} (${subdir})`,
  )

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "asset-sync-"))
  const tmpOut = path.join(tmpBase, "out")

  try {
    await retry(
      async () => {
        rmrf(tmpOut)
        ensureDir(tmpOut)

        await withTimeout(
          (async () => {
            const exportedPath = await gitSparseExport(
              { repo, subdir, ref },
              tmpOut,
            )
            // Copy the exported folder contents into a staging dir
            const staging = path.join(tmpOut, "staging")
            ensureDir(staging)
            cpDir(exportedPath, staging)
          })(),
          10 * 60 * 1000,
          `git export ${repo}@${ref}`,
        )
      },
      { attempts: 3, baseDelayMs: 750 },
    )

    // Swap into place only after we have staging ready
    const staging = path.join(tmpOut, "staging")
    if (!fileExists(staging)) {
      throw new Error("Staging directory missing after export")
    }

    rmrf(absOutDir)
    ensureDir(absOutDir)
    // Put staging contents into absOutDir
    cpDir(staging, absOutDir)

    writeMarker(markerPath, desired)
    console.log(`[asset-sync] ${name ?? absOutDir}: done`)
  } finally {
    rmrf(tmpBase)
  }
}

async function main() {
  // fail fast if git missing
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" })
  } catch {
    throw new Error("git is required for asset-sync but was not found on PATH")
  }

  const cwd = process.cwd()
  const manifestPath = path.join(cwd, MANIFEST_NAME)

  if (!fs.existsSync(manifestPath)) process.exit(0)

  const manifest = readJson(manifestPath)
  const assets = manifest.assets ?? []
  if (!Array.isArray(assets) || assets.length === 0) process.exit(0)

  for (const entry of assets) {
    await syncOne(entry, cwd)
  }
}

main().catch((err) => {
  console.error("[asset-sync] failed:", err?.message ?? err)
  process.exit(1)
})
