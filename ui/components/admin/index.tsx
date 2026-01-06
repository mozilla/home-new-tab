import style from "./style.module.css"

import { PriorityType } from "@common/types"
import { useDiscover } from "@data/state/discover"

/**
 * Admin
 * ---
 * Quick and dirty way to update the priorities of items
 */
export function Admin() {
  const orderedFeeds = useDiscover((state) => state.orderedFeeds)
  if (!orderedFeeds) return null

  return (
    <table className={style.adminTable} data-testid="admin">
      {orderedFeeds.map((feedKey) => (
        <TopicSection key={feedKey} feedKey={feedKey} />
      ))}
    </table>
  )
}

export function TopicSection({ feedKey }: { feedKey: string }) {
  const feed = useDiscover((state) => state.feeds[feedKey])
  const itemIds = feed.recIds

  return (
    <>
      <thead>
        <th colSpan={3} className={style.tableSection}>
          <h2>{feed.title}</h2>
        </th>
      </thead>
      <thead>
        <th>Title</th>
        <th>Publisher</th>
        <th>Priority</th>
      </thead>
      {itemIds.map((id) => (
        <Row itemId={id} key={id} />
      ))}
    </>
  )
}

const Row = ({ itemId }: { itemId: string }) => {
  const itemsById = useDiscover((state) => state.itemsById)

  const item = itemsById[itemId] ?? {}
  const { title, iconUrl, publisher, url, priority = "medium" } = item

  const updateItemById = useDiscover((state) => state.updateItemById)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateItemById({ corpusItemId: itemId, priority: e.target.value })
  }

  return (
    <tr className={style.row}>
      <td>
        <div className={style.title}>
          <a href={url} target="_blank">
            {title}
          </a>
        </div>
      </td>
      <td>
        <div className={style.publisher}>
          {iconUrl ? <img className={style.icon} src={iconUrl} alt="" /> : null}{" "}
          {publisher}
        </div>
      </td>
      <td>
        <div className={style.priorities}>
          <select onChange={handleChange} defaultValue={priority}>
            {Object.values(PriorityType).map((priorityType) => {
              return <option value={priorityType}>{priorityType}</option>
            })}
          </select>
        </div>
      </td>
    </tr>
  )
}
