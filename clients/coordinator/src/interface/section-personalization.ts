import { createBufferedLogger } from "@common/utilities/logger"
import { readJson, writeJson } from "./_storage"

const logger = createBufferedLogger({
  prefix: "Bridge:Section-personalization",
  shouldBuffer: false,
  colors: { log: "#ff6c11" },
})

// Storage key for section personalization state. Defined here so the read
// side (discovery fetch params) and write side (host callbacks) stay coupled.
const STORAGE_KEY = "coordinator:section-prefs"

type SectionPrefs = {
  followed: string[]
  blocked: string[]
}

const DEFAULT_PREFS: SectionPrefs = { followed: [], blocked: [] }

/**
 * getSectionPrefs
 * ---
 * Returns persisted section personalization state for inclusion in Merino
 * request params. Called by the discovery data source on every fetch.
 */
export function getSectionPrefs(): SectionPrefs {
  return readJson<SectionPrefs>(STORAGE_KEY, DEFAULT_PREFS)
}

/**
 * onSectionFollowed
 * ---
 * Records a section follow in coordinator storage. The preference is included
 * in the next Merino request so the feed reflects the user's intent.
 */
export function onSectionFollowed(sectionId: string): void {
  const prefs = getSectionPrefs()
  if (prefs.followed.includes(sectionId)) return
  writeJson(STORAGE_KEY, { ...prefs, followed: [...prefs.followed, sectionId] })
  logger.info("sectionFollowed", { sectionId })
}

/**
 * onSectionUnfollowed
 * ---
 * Removes a section from the followed list in coordinator storage.
 */
export function onSectionUnfollowed(sectionId: string): void {
  const prefs = getSectionPrefs()
  writeJson(STORAGE_KEY, {
    ...prefs,
    followed: prefs.followed.filter((id) => id !== sectionId),
  })
  logger.info("sectionUnfollowed", { sectionId })
}

/**
 * onSectionBlocked
 * ---
 * Records a section block in coordinator storage. Also removes the section
 * from the followed list if present — a blocked section cannot be followed.
 */
export function onSectionBlocked(sectionId: string): void {
  const prefs = getSectionPrefs()
  if (prefs.blocked.includes(sectionId)) return
  writeJson(STORAGE_KEY, {
    followed: prefs.followed.filter((id) => id !== sectionId),
    blocked: [...prefs.blocked, sectionId],
  })
  logger.info("sectionBlocked", { sectionId })
}
