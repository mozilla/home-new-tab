import style from "./style.module.css"

import { MenuOverflow, MenuOverflowPosition } from "../menu-overflow"
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
      <div className={style.overflow}>
        <MenuOverflow position={MenuOverflowPosition.BOTTOM_RIGHT}>
          {({ close }) =>
            actions ? (
              <>
                {actions.reverse().map((action) => {
                  const onClick = () => {
                    action.action()
                    close()
                  }
                  return (
                    <button key={action.name} onClick={onClick}>
                      {action.name}
                    </button>
                  )
                })}
              </>
            ) : null
          }
        </MenuOverflow>
      </div>
    </article>
  )
}
