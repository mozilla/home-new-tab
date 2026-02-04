import style from "./style.module.css"

import { useMenuOverflow } from "../menu-overflow"
import { useDiscover } from "@data/state/discover"

/**
 * DiscoverCard
 * ---
 * Baseline card for discovery feed
 */
export function DiscoverCard({
  itemId,
  showPriority = false,
}: {
  itemId: string
  showPriority?: boolean
}) {
  const { close, withClose, Panel, Trigger, rootRef } =
    useMenuOverflow<HTMLElement>()
  const updateItemById = useDiscover((state) => state.updateItemById)

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
      data-testid="discover-card"
      ref={rootRef}
      onMouseLeave={close}>
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
      <div className={style.actions}>
        <Trigger />
        <Panel>
          {showPriority ? (
            <>
              <button
                onClick={withClose(() =>
                  updateItemById({ corpusItemId: itemId, priority: "high" }),
                )}>
                High Priority
              </button>
              <button
                onClick={withClose(() =>
                  updateItemById({ corpusItemId: itemId, priority: "medium" }),
                )}>
                Medium Priority
              </button>
              <button
                onClick={withClose(() =>
                  updateItemById({ corpusItemId: itemId, priority: "low" }),
                )}>
                Low Priority
              </button>
              <hr />
            </>
          ) : null}
          <button
            role="menuitem"
            onClick={withClose(() => console.log(itemId))}>
            <span>Bookmark</span>
          </button>
          <hr />
          <button
            role="menuitem"
            onClick={withClose(() => console.log(itemId))}>
            <span>Open in a New Window</span>
          </button>
          <button role="menuitem">
            <span>Open in a New Private Window</span>
          </button>
          <hr />
          <button
            role="menuitem"
            onClick={withClose(() => console.log(itemId))}>
            <span>Dismiss</span>
          </button>
          <button
            role="menuitem"
            onClick={withClose(() => console.log(itemId))}>
            <span>Report</span>
          </button>
        </Panel>
      </div>
    </article>
  )
}
