import style from "./style.module.css"

import { useMenuOverflow } from "../menu-overflow"
import { useDiscover } from "@data/state/discover"

/**
 * DiscoverCardRole
 * ---
 * Structural role assigned by the layout system (e.g. "hero").
 * This is NOT editorial priority but is informed by it
 */
type DiscoverCardRole = "hero"

/**
 * DiscoverCard
 * ---
 * Baseline card for discovery feed that displays article content:
 * - Renders image, title, excerpt, and publisher information
 * - Uses menu overflow pattern for action menu visibility on hover
 * 
 * DEV: 
 * - Supports two operation modes via `showPriority`:
 *   - Priority editing mode: Shows High/Medium/Low priority buttons
 *   - Standard mode: Shows Bookmark, Open, Dismiss, and Report actions
 */
export function DiscoverCard({
  itemId,
  role,
  showPriority = false,
  className,
}: {
  /** ID of the discover feed item to render */
  itemId: string
  /** Structural role assigned by the layout system (e.g., "hero") */
  role?: DiscoverCardRole
  /** Enable priority editing mode instead of standard actions */
  showPriority?: boolean
  /** Optional CSS class for additional styling */
  className?: string
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
      className={`${className && className} ${style.base}`}
      data-priority={priority}
      data-testid="discover-card"
      data-role={role}
      ref={rootRef}
      onMouseLeave={close}>
      <a href={url} className={style.inner}>
        <picture>
          <source srcSet={imageUrl} media="(width >= 600px)" />
          <img src={imageUrl} alt="" />
          {/* Priority badge shown only in priority editing mode */}
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
          {/* Menu mode: Priority editing vs standard actions */}
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
            </>
          ) : (
            <>
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
            </>
          )}
        </Panel>
      </div>
    </article>
  )
}
