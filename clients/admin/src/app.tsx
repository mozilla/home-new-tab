import { Admin } from "@ui/components/admin"
import { useEffect } from "react"
import { useDiscover } from "@data/state/discover"

export function App() {
  const getFeed = useDiscover((state) => state.getFeed)

  useEffect(() => {
    getFeed()
  }, [getFeed])

  return (
    <div className="page-container">
      <h1>Admin</h1>
      <Admin />
    </div>
  )
}
