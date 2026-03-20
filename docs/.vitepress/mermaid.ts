import type { MarkdownRenderer } from "vitepress"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function mermaidRenderer(md: MarkdownRenderer): void {
  const defaultFence = md.renderer.rules.fence

  if (!defaultFence) {
    throw new Error("VitePress fence renderer is unavailable")
  }

  md.renderer.rules.fence = (tokens, index, options, env, slf) => {
    const token = tokens[index]
    const language = token.info.trim()

    if (language.startsWith("mermaid")) {
      const showCode = language === "mermaid-example"
      return `
<Suspense>
  <template #default>
    <Mermaid
      id="mermaid-${index}"
      :showCode="${showCode}"
      graph="${encodeURIComponent(token.content)}"
    />
  </template>
  <template #fallback>
    Loading...
  </template>
</Suspense>
`
    }

    if (language === "warning") {
      return `<div class="warning custom-block"><p class="custom-block-title">WARNING</p><p>${escapeHtml(token.content)}</p></div>`
    }

    if (language === "note") {
      return `<div class="tip custom-block"><p class="custom-block-title">NOTE</p><p>${escapeHtml(token.content)}</p></div>`
    }

    if (language === "regexp") {
      token.info = "javascript"
      token.content = `/${token.content.trimEnd()}/\n`
      return defaultFence(tokens, index, options, env, slf)
    }

    if (language === "jison") {
      return `<div class="language-">
  <button class="copy"></button>
  <span class="lang">jison</span>
  <pre><code>${escapeHtml(token.content)}</code></pre>
</div>`
    }

    return defaultFence(tokens, index, options, env, slf)
  }
}
