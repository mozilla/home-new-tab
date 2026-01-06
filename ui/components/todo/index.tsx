import style from "./style.module.css"

/**
 * ToDo
 * ---
 * You are never gonna believe this ... this is a list of things to do ... a ToDo list if you will
 * NOTE: We may need to rename this to make it more clear what it does
 */
export function ToDo() {
  return (
    <div className={style.base} data-testid="todo">
      <header>
        <div>Title</div>
        <div>
          <button className={style.overflow}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7 11H5.5L5 11.5V13L5.5 13.5H7L7.5 13V11.5L7 11ZM12.75 11H11.25L10.75 11.5V13L11.25 13.5H12.75L13.25 13V11.5L12.75 11ZM17 11H18.5L19 11.5V13L18.5 13.5H17L16.5 13V11.5L17 11Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </header>
      <button className={style.add}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path
            d="M7.005 9.75V14C7.005 14.1658 7.07085 14.3247 7.18806 14.4419C7.30527 14.5592 7.46424 14.625 7.63 14.625C7.79577 14.625 7.95474 14.5592 8.07195 14.4419C8.18916 14.3247 8.255 14.1658 8.255 14V9.75L8.755 9.25H13.005C13.1708 9.25 13.3297 9.18415 13.4469 9.06694C13.5642 8.94973 13.63 8.79076 13.63 8.625C13.63 8.45924 13.5642 8.30027 13.4469 8.18306C13.3297 8.06585 13.1708 8 13.005 8H8.755L8.255 7.5V3.25C8.255 3.08424 8.18916 2.92527 8.07195 2.80806C7.95474 2.69085 7.79577 2.625 7.63 2.625C7.46424 2.625 7.30527 2.69085 7.18806 2.80806C7.07085 2.92527 7.005 3.08424 7.005 3.25V7.5L6.505 8H2.255C2.08924 8 1.93027 8.06585 1.81306 8.18306C1.69585 8.30027 1.63 8.45924 1.63 8.625C1.63 8.79076 1.69585 8.94973 1.81306 9.06694C1.93027 9.18415 2.08924 9.25 2.255 9.25H6.392L7.005 9.75Z"
            fill="currentColor"
          />
        </svg>
        Add an item
      </button>
      <ul className={style.list}>
        <li>
          <input type="checkbox" />
          Some Item
        </li>
      </ul>

      <footer>The possibilities are endless. Add one.</footer>
    </div>
  )
}
