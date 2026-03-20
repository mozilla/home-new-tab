// https://vitepress.dev/guide/custom-theme
import { h } from "vue"
import Mermaid from "./components/mermaid.vue"
import type { Theme } from "vitepress"
import DefaultTheme from "vitepress/theme"
import "./style.css"

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },
  enhanceApp({ app, router, siteData }) {
    app.component("Mermaid", Mermaid)
  },
} satisfies Theme
