import style from "./style.module.css"

import { useEffect, useState } from "react"

export const weatherIcons: Record<string, string | null> = {
  iconId1: "sunny",
  iconId2: "mostly-sunny",
  iconId3: "partly-sunny",
  iconId4: "partly-sunny",
  iconId5: "hazy-sunshine",
  iconId6: "partly-sunny",
  iconId7: "cloudy",
  iconId8: "cloudy",
  iconId9: null,
  iconId10: null,
  iconId11: "fog",
  iconId12: "showers",
  iconId13: "mostly-cloudy-with-showers",
  iconId14: "mostly-cloudy-with-showers",
  iconId15: "thunderstorms",
  iconId16: "mostly-cloudy-with-thunderstorms",
  iconId17: "mostly-cloudy-with-thunderstorms",
  iconId18: "rain",
  iconId19: "flurries",
  iconId20: "flurries",
  iconId21: "partly-sunny-with-flurries",
  iconId22: "snow",
  iconId23: "snow",
  iconId24: "ice",
  iconId25: "flurries",
  iconId26: "freezing-rain",
  iconId27: null,
  iconId28: null,
  iconId29: "freezing-rain",
  iconId30: "hot",
  iconId31: "ice",
  iconId32: "windy",
  iconId33: "night-clear",
  iconId34: "night-mostly-clear",
  iconId35: "night-mostly-clear",
  iconId36: "night-mostly-clear",
  iconId37: "night-hazy-moonlight",
  iconId38: "night-mostly-clear",
  iconId39: "night-partly-cloudy-with-showers",
  iconId40: "night-partly-cloudy-with-showers",
  iconId41: "night-partly-cloudy-with-thunderstorms",
  iconId42: "night-partly-cloudy-with-thunderstorms",
  iconId43: "night-mostly-cloudy-with-flurries",
  iconId44: "night-mostly-cloudy-with-flurries",
}

/**
 * WeatherIcons
 * ---
 * This is just a quick patch to use built-in FF icons everywhere (like storybooks)
 * NOTE: This is all unnecessary in firefox ... but if we ever decide we want to
 * support alternate browsers (more surface income) we would simply update the
 * iconography to be more cross browser compatible.
 */
export function WeatherIcon({ iconId }: { iconId: string }) {
  const [iconSrc, setIconSrc] = useState<string | null>(null)
  const iconToLoad = weatherIcons[iconId]
  const iconPath = `./icons/${iconToLoad}.svg`

  useEffect(() => {
    if (iconToLoad) loadPatchedSvg(iconPath).then(setIconSrc)
  }, [iconPath, iconToLoad])

  return iconSrc ? (
    <div
      className={style.base}
      data-testid="weather-icons"
      dangerouslySetInnerHTML={{ __html: iconSrc }}
    />
  ) : null
}

export async function loadPatchedSvg(path: string): Promise<string> {
  const mod = await import(`${path}?raw`)
  return mod.default
    .replace(/stroke\s*:\s*context-stroke\s+/g, "stroke: ")
    .replace(/fill\s*:\s*context-fill\s+/g, "fill: ") as string
}
