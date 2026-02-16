import style from "./style.module.css"

import { Brand } from "../header-brand"
import { Search } from "../header-search"

/**
 * Header
 * ---
 * This is where we put all the footer content ....
 * _checks notes_ ... sorry, it is the header
 */
export function Header() {
  return (
    <div className={style.base} data-testid="header">
      <Brand />
      <Search />
    </div>
  )
}
