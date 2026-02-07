import style from "./style.module.css"

import type { PropsWithChildren } from "react"

/**
 * WidgetContainer
 * ---
 * This is just a baseline grid wrapper for now. Down the road we will make
 * it a more dynamic affair where it can have a collapsed state, which will
 * persist down to the passed in children
 */
export function WidgetContainer({ children }: PropsWithChildren) {
  return (
    <div className={style.base} data-testid="widget-container">
      <div className={style.grid}>{children}</div>
    </div>
  )
}
