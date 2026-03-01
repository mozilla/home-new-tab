import type { PlopTypes } from "@turbo/gen"

import { uiPlop } from "./ui-component/_plop"
import { statePlop } from "./data-state/_plop"
import { featurePlop} from './feature.plop'

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("Component", uiPlop)
  plop.setGenerator("State", statePlop)
  plop.setGenerator("Component+State", featurePlop)

  plop.setHelper("upperSnakeCase", (text: string) => {
    if (typeof text !== "string") return ""

    // normalize separators -> space, split into words
    const parts = text
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase -> words
      .replace(/[^A-Za-z0-9]+/g, " ")        // kebab/dots/etc -> spaces
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p.toUpperCase())

    return parts.join("_")
  })
}
