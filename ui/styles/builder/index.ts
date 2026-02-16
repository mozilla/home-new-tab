import StyleDictionary from "style-dictionary"
import config from "./sd.config"

async function build() {
  const sd = new StyleDictionary(config)
  await sd.hasInitialized
  await sd.buildAllPlatforms()
}

build()
