import style from "./style.module.css"

/**
 * Search
 * ---
 * This is a search bar ... it has not actual function at present (hands off to awesome bar)
 */
export function Search() {
  return (
    <div className={style.base} data-testid="header-search">
      <input type="text" />
    </div>
  )
}
