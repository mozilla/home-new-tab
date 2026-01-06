import style from "../discover-card/style.module.css"

import { useSponsored } from "@data/state/sponsored"
/**
 * DiscoverSponsored
 * ---
 * Just a placeholder ad for now
 */
export function Sponsored({ itemId }: { itemId: string }) {
  const itemsById = useSponsored((state) => state.itemsById)
  if (!itemsById[itemId]) return null // Let's not return anything if nothing exists

  const item = itemsById[itemId] ?? {}
  const { excerpt, image_url, sponsor, title, url } = item

  return (
    <article className={style.base} data-spoc={true} data-testid="sponsored">
      <a href={url} className={style.inner}>
        <picture>
          <source srcSet={image_url} media="(width >= 600px)" />
          <img src={image_url} alt="" />
        </picture>
        <div className={style.meta}>
          <div className={style.copy}>
            <h3 className={style.title}>{title}</h3>
            <p className={style.excerpt}>{excerpt}</p>
          </div>
          <footer>
            <div className={style.sponsor}>Sponsored by {sponsor}</div>
          </footer>
        </div>
      </a>
    </article>
  )
}
