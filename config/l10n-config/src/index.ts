export { fluentL10n } from "./plugins/vite-plugin"

export {
  clearFtlCache,
  collectFtlFiles,
  computeL10nHash,
  extractMessageIds,
  findClosestMessageId,
  getLocalFtlPath,
  getLocalMessage,
  getLocalMessages,
  getRawLocalMessage,
  getRawLocalMessages,
  hasLocalFtl,
} from "./utilities/fluent-utils"

export type { LocalMessages, RawLocalMessages } from "./utilities/fluent-utils"

export { buildTranslationManifest } from "./utilities/translation-manifest"
export type { TranslationManifest } from "./utilities/translation-manifest"
