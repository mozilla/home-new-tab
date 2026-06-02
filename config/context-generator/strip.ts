/**
 * Markdown stripping utilities for LLM context compilation.
 * Transforms human-readable docs into dense, token-efficient text.
 */

/** Remove VitePress container callouts (::: tip, ::: details, etc.) */
export function stripCallouts(content: string): string {
  return content.replace(/^:::.*$\n?/gm, "")
}

/** Remove mermaid diagram blocks entirely */
export function stripMermaid(content: string): string {
  return content.replace(/```mermaid[\s\S]*?```\n?/g, "")
}

/** Remove code blocks (optional — preserves inline code) */
export function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```\n?/g, "")
}

/** Remove "Related documentation" footer section and everything after */
export function stripRelatedDocs(content: string): string {
  return content.replace(/\n##?\s*Related documentation[\s\S]*$/i, "")
}

/** Remove "How to read/reason about" guidance sections */
export function stripGuidanceSections(content: string): string {
  return content.replace(
    /\n##?\s*How to (?:read|reason about|use)[\s\S]*?(?=\n##?\s|\n*$)/gi,
    "",
  )
}

/** Convert markdown links to plain text: [text](url) → text */
export function stripLinks(content: string): string {
  return content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
}

/** Remove H1 headers (output provides its own structure) */
export function stripH1(content: string): string {
  return content.replace(/^# .*$\n?/gm, "")
}

/** Promote all headers by one level for nesting under output sections */
export function promoteHeaders(content: string): string {
  return content.replace(/^(#{2,5}) /gm, "#$1 ")
}

/** Collapse multiple blank lines to a single blank line */
export function collapseBlankLines(content: string): string {
  return content.replace(/\n{3,}/g, "\n\n")
}

/** Remove HTML comments */
export function stripComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, "")
}

/**
 * Apply all stripping transforms in order.
 * Returns dense, LLM-ready text.
 */
export function strip(content: string): string {
  let result = content
  result = stripCallouts(result)
  result = stripMermaid(result)
  result = stripRelatedDocs(result)
  result = stripGuidanceSections(result)
  result = stripLinks(result)
  result = stripH1(result)
  result = stripComments(result)
  result = promoteHeaders(result)
  result = collapseBlankLines(result)
  return result.trim()
}

/**
 * Extract specific sections by header text.
 * Returns content under matching ## headers (inclusive of sub-headers).
 */
export function extractSections(content: string, headers: string[]): string {
  const lines = content.split("\n")
  const extracted: string[] = []
  let capturing = false
  let captureLevel = 0

  for (const line of lines) {
    const headerMatch = line.match(/^(#{2,6})\s+(.+)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const text = headerMatch[2].trim()

      if (headers.some((h) => text.toLowerCase().includes(h.toLowerCase()))) {
        capturing = true
        captureLevel = level
        extracted.push(line)
        continue
      }

      // Stop capturing if we hit a same-or-higher-level header
      if (capturing && level <= captureLevel) {
        capturing = false
      }
    }

    if (capturing) {
      extracted.push(line)
    }
  }

  return extracted.join("\n")
}
