<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useData, useRoute } from "vitepress"
import mermaid from "mermaid"

const props = defineProps<{
  id: string
  graph: string
  showCode?: boolean
}>()

const el = ref<HTMLElement | null>(null)

const { isDark } = useData()
const route = useRoute()

let renderId = 0

const decodedGraph = computed(() => {
  try {
    return decodeURIComponent(props.graph)
  } catch {
    return props.graph
  }
})

function initMermaid(): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark.value ? "dark" : "default",
  })
}

async function renderDiagram(): Promise<void> {
  if (!el.value) return

  await nextTick()

  try {
    const currentId = `mermaid-svg-${props.id}-${renderId++}`
    const { svg } = await mermaid.render(currentId, decodedGraph.value)
    el.value.innerHTML = svg
  } catch (err) {
    el.value.innerHTML = `<pre style="color:red;">Mermaid render error:\n${String(err)}</pre>`
  }
}

onMounted(async () => {
  initMermaid()
  await renderDiagram()
})

watch(
  () => route.path,
  async () => {
    initMermaid()
    await renderDiagram()
  },
)

watch(isDark, async () => {
  initMermaid()
  await renderDiagram()
})

watch(
  () => props.graph,
  async () => {
    initMermaid()
    await renderDiagram()
  },
)

onBeforeUnmount(() => {
  if (el.value) {
    el.value.innerHTML = ""
  }
})
</script>

<template>
  <div class="mermaid-wrapper">
    <div ref="el" />

    <details v-if="showCode" class="mermaid-code">
      <summary>Show source</summary>
      <pre><code>{{ decodedGraph }}</code></pre>
    </details>
  </div>
</template>
