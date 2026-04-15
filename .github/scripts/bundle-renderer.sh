#!/usr/bin/env bash
# Bundle the renderer's required build artifacts into a zip.
#
# Usage: bundle-renderer.sh <output.zip>
#
# Run after `pnpm run build` to test locally:
#   pnpm run build && bash .github/scripts/bundle-renderer.sh renderer-test.zip
set -euo pipefail

OUTPUT="${1:?usage: bundle-renderer.sh <output.zip>}"
DIST="$(git rev-parse --show-toplevel)/clients/renderer/dist"
MANIFEST="$DIST/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "error: $MANIFEST not found — run pnpm run build first" >&2
  exit 1
fi

# Read artifact paths from the manifest. Optional fields use // empty so jq
# returns an empty string rather than the literal string "null".
JS_FILE=$(jq -r '.file'              "$MANIFEST")
CSS_FILE=$(jq -r '.cssFile // empty' "$MANIFEST")
SCHEMA_FILE=$(jq -r '.schemaFile // empty' "$MANIFEST")
FTL_FILE=$(jq -r '.baselineFtlFile // empty' "$MANIFEST")

# Build the file list. Always include manifest + JS; add optional artifacts only
# when present so we don't pass empty strings to zip.
FILES=(manifest.json "$JS_FILE")
[[ -n "$CSS_FILE"    ]] && FILES+=("$CSS_FILE")
[[ -n "$SCHEMA_FILE" ]] && FILES+=("$SCHEMA_FILE")
[[ -n "$FTL_FILE"    ]] && FILES+=("$FTL_FILE")

echo "Bundling ${#FILES[@]} artifacts from $DIST:"
for f in "${FILES[@]}"; do echo "  $f"; done

(cd "$DIST" && zip "$OLDPWD/$OUTPUT" "${FILES[@]}")

echo ""
echo "Created: $OUTPUT"
unzip -l "$OUTPUT"
