# POC renderer info debug panel
renderer-info-title = Intentionally Boring Renderer

# Variables:
#   $cached (String) - "true" for a remotely loaded renderer, "false" for the bundled fallback
renderer-info-renderer-type =
    { $cached ->
        [true] Rendered by: remote renderer
       *[false] Rendered by: fallback renderer
    }

# Section header for the renderer metadata panel.
# Variables:
#   $updating (String) - "true" when a renderer update is pending, "false" otherwise
renderer-info-renderer-section =
    { $updating ->
        [true] Renderer — will update
       *[false] Renderer — cached
    }

# Section header for the data state panel.
# Variables:
#   $updating (String) - "true" when stale data is refreshing, "false" otherwise
renderer-info-data-section =
    { $updating ->
        [true] Data — will update
       *[false] Data — cached
    }

# Variables:
#   $cached (String) - "true" for a remotely loaded renderer, "false" for the bundled fallback
renderer-info-renderer-source =
    { $cached ->
        [true] Renderer Source: remote
       *[false] Renderer Source: bundled
    }

# Variables:
#   $hash (String) - Content hash of the current renderer entry artifact
renderer-info-hash = Hash: { $hash }

# Variables:
#   $hash (String) - Content hash of the pending next renderer version
renderer-info-next-hash = Next Hash: { $hash }

# Variables:
#   $version (String) - Data schema version identifier
renderer-info-schema-version = Data Schema Version: { $version }

# Variables:
#   $time (String) - Human-readable build timestamp
renderer-info-build-time = Build Time: { $time }

# Variables:
#   $duration (String) - Formatted time remaining (e.g. "1m 30s")
renderer-info-time-to-ttl = Time to TTL: { $duration }

# Variables:
#   $duration (String) - Formatted time remaining (e.g. "29m 30s")
renderer-info-time-to-stale = Time to Stale: { $duration }

# Section header for the bridge invocation panel.
renderer-info-bridges-section = Bridges

# Group labels within the bridges panel.
renderer-info-bridges-reporting = Reporting
renderer-info-bridges-content-actions = Content Actions
renderer-info-bridges-messaging = Messaging
