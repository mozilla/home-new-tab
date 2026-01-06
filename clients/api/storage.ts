import { promises as fs } from "fs"
import path from "path"
import type { PriorityMap, AppRenderManifest } from "@common/types"

const MANIFEST_PATH = path.resolve(process.cwd(), "data/renderer/manifest.json")
const STORAGE_DIR = path.resolve(process.cwd(), "data")
const STORAGE_PATH = path.join(STORAGE_DIR, "priorities.json")
const MOCK_PATH = path.join(STORAGE_DIR, "mock.json")

// super tiny write lock to prevent overlapping writes
let writeLock: Promise<void> = Promise.resolve()

async function ensureStore() {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
  try {
    await fs.access(STORAGE_PATH)
  } catch {
    await fs.writeFile(STORAGE_PATH, "{}", "utf8")
  }
}

export async function readPriorities(): Promise<PriorityMap> {
  await ensureStore()
  const raw = await fs.readFile(STORAGE_PATH, "utf8")
  try {
    return JSON.parse(raw) as PriorityMap
  } catch {
    // file was corrupted or hand-edited incorrectly; reset
    return {}
  }
}

export async function writePriorities(next: PriorityMap): Promise<void> {
  await ensureStore()
  const tmp = STORAGE_PATH + ".tmp"
  // Serialize writes so rename stays atomic
  writeLock = writeLock.then(async () => {
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8")
    await fs.rename(tmp, STORAGE_PATH)
  })
  return writeLock
}

export async function readMock(
  shouldDelay: boolean = false,
): Promise<{ color?: string }> {
  // Adding this delay to simulate some approximation of latency
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))
  if (shouldDelay) await delay(2000)

  const raw = await fs.readFile(MOCK_PATH, "utf8")
  try {
    return JSON.parse(raw)
  } catch {
    // file was corrupted or hand-edited incorrectly; reset
    return {}
  }
}
