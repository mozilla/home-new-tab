import style from "./style.module.css"

import { useState, useEffect, useRef } from "react"
import { useDiscover } from "@data/state/discover"

import type { DiscoverItemAction } from "@common/types"

/**
 * DiscoverCard
 * ---
 * Baseline card for discovery feed
 */
export function DiscoverCard({
  itemId,
  actions,
  showPriority,
}: {
  itemId: string
  actions?: DiscoverItemAction[]
  showPriority?: boolean
}) {
  const itemsById = useDiscover((state) => state.itemsById)

  const item = itemsById[itemId] ?? {}
  const {
    title,
    excerpt,
    imageUrl,
    iconUrl,
    publisher,
    url,
    priority = "medium",
  } = item

  return (
    <article
      className={style.base}
      data-priority={priority}
      data-testid="discover-card">
      <a href={url} className={style.inner}>
        <picture>
          <source srcSet={imageUrl} media="(width >= 600px)" />
          <img src={imageUrl} alt="" />
          {showPriority ? (
            <div className={style.priority}>{priority}</div>
          ) : null}
        </picture>
        <div className={style.meta}>
          <div className={style.copy}>
            <h3 className={style.title}>{title}</h3>
            <p className={style.excerpt}>{excerpt}</p>
          </div>
          <footer>
            <div className={style.publisher}>
              {iconUrl ? (
                <img
                  className={style.publisherIcon}
                  src={iconUrl}
                  alt=""
                  height="20px"
                  width="20px"
                />
              ) : null}
              <div className={style.publisherCopy}>{publisher}</div>
            </div>
          </footer>
        </div>
      </a>
      <OverflowMenu actions={actions} />
    </article>
  )
}

export function OverflowMenu({ actions }: { actions?: DiscoverItemAction[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const openMenu = () => setMenuOpen(true)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) closeMenu()
    }

    document.addEventListener("click", handleClick, true)
    return () => {
      document.removeEventListener("click", handleClick, true)
    }
  }, [ref, closeMenu])

  return (
    <div className={style.more} ref={ref}>
      {actions && menuOpen ? (
        <div className={style.menu}>
          {actions.reverse().map((action) => {
            const onClick = () => {
              action.action()
              closeMenu()
            }
            return (
              <button key={action.name} onClick={onClick}>
                {action.name}
              </button>
            )
          })}
        </div>
      ) : null}
      <button className={style.trigger} onClick={openMenu}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="context-fill"
          fillOpacity="context-fill-opacity">
          <path d="M3 7 1.5 7l-.5.5L1 9l.5.5 1.5 0 .5-.5 0-1.5z" />
          <path d="m8.75 7-1.5 0-.5.5 0 1.5.5.5 1.5 0 .5-.5 0-1.5z" />
          <path d="M14.5 7 13 7l-.5.5 0 1.5.5.5 1.5 0L15 9l0-1.5z" />
        </svg>
      </button>
    </div>
  )
}
