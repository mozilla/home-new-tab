#!/usr/bin/env bash
# Bundle the renderer's required build artifacts into a zip.
#
# Usage: bundle-renderer.sh <output.zip>
#
# Run after `pnpm run build` to test locally:
#   pnpm run build && bash .github/scripts/bundle-renderer.sh renderer-test.zip
set -euo pipefail

OUTPUT="${1:?usage: bundle-renderer.sh <output.zip>}"

# Resolve to absolute path before any cd operations. $OLDPWD is unreliable
# when the caller passes an absolute path (CI passes $GITHUB_WORKSPACE/...).
[[ "$OUTPUT" != /* ]] && OUTPUT="$(pwd)/$OUTPUT"

DIST="$(git rev-parse --show-toplevel)/clients/renderer/dist"
MANIFEST="$DIST/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "error: $MANIFEST not found — run pnpm run build first" >&2
  exit 1
fi

JS_FILE=$(jq -r '.file'             "$MANIFEST")
CSS_FILE=$(jq -r '.cssFile'         "$MANIFEST")
SCHEMA_FILE=$(jq -r '.schemaFile'   "$MANIFEST")
FTL_FILE=$(jq -r '.baselineFtlFile' "$MANIFEST")

# All four artifacts are contractually required. Fail explicitly if any are
# absent from the manifest or missing on disk — don't silently skip them.
FAILED=0
for FILE in "$JS_FILE" "$CSS_FILE" "$SCHEMA_FILE" "$FTL_FILE"; do
  if [[ "$FILE" == "null" || -z "$FILE" ]]; then
    echo "error: required artifact missing from manifest" >&2
    FAILED=1
  elif [[ ! -f "$DIST/$FILE" ]]; then
    echo "error: artifact declared in manifest but not on disk: $FILE" >&2
    FAILED=1
  fi
done
[[ $FAILED -eq 0 ]] || exit 1

echo "Bundling 5 artifacts from $DIST:"
for f in manifest.json "$JS_FILE" "$CSS_FILE" "$SCHEMA_FILE" "$FTL_FILE"; do
  echo "  $f"
done

(cd "$DIST" && zip "$OUTPUT" manifest.json "$JS_FILE" "$CSS_FILE" "$SCHEMA_FILE" "$FTL_FILE")

echo ""
echo "Created: $OUTPUT"
unzip -l "$OUTPUT"
