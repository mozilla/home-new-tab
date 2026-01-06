import { GridType } from "@common/types"
import { useDiscover } from "@data/state/discover"
import { useEffect } from "react"
import { DiscoverFeed } from "@ui/components/discover-feed"
import { Header } from "@ui/components/header"
import { Grid } from "@ui/components/structure-grid"
import { Timers } from "@ui/components/timer"
import { ToDo } from "@ui/components/todo"

export function App() {
  const getFeed = useDiscover((state) => state.getFeed)

  useEffect(() => {
    getFeed()
  }, [getFeed])

  return (
    <div className="page-container">
      <Header />
      <Grid gridType={GridType.FLUID}>
        <Timers />
        <ToDo />
      </Grid>

      <DiscoverFeed />
    </div>
  )
}
