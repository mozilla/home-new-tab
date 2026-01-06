import { useDiscover } from "@data/state/discover"
import { useEffect } from "react"
import { Admin } from "@ui/components/admin"

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
