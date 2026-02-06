import { DiscoverFeed } from "@ui/components/discover-feed"
import { Header } from "@ui/components/header"
import { Timer } from "@ui/components/timer"
import { ToDo } from "@ui/components/todo"
import { useEffect } from "react"
import { useDiscover } from "@data/state/discover"

/**
 * App
 * ---
 * Main application entry point for the home tab UI:
 * - Orchestrates the page layout with Header, Grid, Timer, ToDo, and DiscoverFeed
 * - Initializes the discover feed data on mount
 * - Provides the top-level container structure
 */
export function App() {
  const getFeed = useDiscover((state) => state.getFeed)

  // Initialize the discover feed on component mount
  useEffect(() => {
    getFeed()
  }, [getFeed])

  return (
    <div className="page-container">
      <Header />
      <Timer />
      <ToDo />
      <DiscoverFeed />
    </div>
  )
}
