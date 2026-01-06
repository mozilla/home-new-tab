import style from "./style.module.css"

import { GridType } from "@common/types"

/**
 * StructureGrid
 * ---
 * Baseline grid that let's us just shift layouts of cards
 */
export function Grid({
  gridType = GridType.EVEN,
  layout = "",
  children,
}: {
  gridType: GridType
  layout?: string
  children: React.ReactNode
}) {
  return (
    <div className={style.base} data-testid="grid">
      <div className="grid" data-grid-type={gridType} data-layout={layout}>
        {children}
      </div>
    </div>
  )
}
