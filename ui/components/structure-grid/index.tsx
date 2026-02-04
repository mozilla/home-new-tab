import style from "./style.module.css"

/**
 * StructureGrid
 * ---
 * Baseline grid that let's us just shift layouts of cards
 */
export function Grid({
  layout = "",
  children,
}: {
  layout?: string
  children: React.ReactNode
}) {
  return (
    <div className={style.base} data-testid="grid">
      <div className="grid" data-layout={layout}>
        {children}
      </div>
    </div>
  )
}
