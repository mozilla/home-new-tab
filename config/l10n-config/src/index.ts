export { fluentL10n } from "./plugins/vite-plugin"

export {
  clearFtlCache,
  findClosestMessageId,
  getLocalFtlPath,
  getLocalMessages,
  hasLocalFtl,
} from "./utilities/fluent-utils"

export type { LocalMessages } from "./utilities/fluent-utils"
