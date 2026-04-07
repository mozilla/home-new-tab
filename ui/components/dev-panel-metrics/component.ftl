# Section header for the renderer metadata panel.
# Variables:
#   $updating (String) - "true" when a renderer update is pending, "false" otherwise
dev-panel-metrics-section =
    { $updating ->
        [true] Renderer — will update
       *[false] Renderer — cached
    }

# Variables:
#   $cached (String) - "true" for a remotely loaded renderer, "false" for the bundled fallback
dev-panel-metrics-source =
    { $cached ->
        [true] Renderer Source: remote
       *[false] Renderer Source: bundled
    }

# Variables:
#   $hash (String) - Content hash of the current renderer entry artifact
dev-panel-metrics-hash = Hash: { $hash }

# Variables:
#   $hash (String) - Content hash of the pending next renderer version
dev-panel-metrics-next-hash = Next Hash: { $hash }

# Variables:
#   $version (String) - Data schema version identifier
dev-panel-metrics-schema-version = Data Schema Version: { $version }

# Variables:
#   $time (String) - Human-readable build timestamp
dev-panel-metrics-build-time = Build Time: { $time }
