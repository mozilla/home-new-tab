import esbuild from "esbuild"

const watch = process.argv.includes("--watch")

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/extension.js",
  sourcemap: true,
  target: "node20",
  external: ["vscode"],
  logLevel: "info",
})

if (watch) {
  await ctx.watch()
} else {
  await ctx.rebuild()
  await ctx.dispose()
}
