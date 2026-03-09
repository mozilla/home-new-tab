export { fluentL10n } from "./plugins/vite-plugin"

export {
  clearFtlCache,
  findClosestMessageId,
  getLocalFtlPath,
  getLocalMessage,
  getLocalMessages,
  getRawLocalMessage,
  getRawLocalMessages,
  hasLocalFtl,
} from "./utilities/fluent-utils"

export type { LocalMessages, RawLocalMessages } from "./utilities/fluent-utils"
