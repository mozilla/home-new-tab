# POC renderer dev debug panel
dev-panel-title = Intentionally Boring Renderer

# Variables:
#   $cached (String) - "true" for a remotely loaded renderer, "false" for the bundled fallback
dev-panel-renderer-type =
    { $cached ->
        [true] Rendered by: remote renderer
       *[false] Rendered by: fallback renderer
    }
