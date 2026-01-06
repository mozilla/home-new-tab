/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  "*.{ts,tsx}": [
    () => "tsc --noEmit",
    "eslint --cache --fix",
    "prettier --write",
  ],
  "*.css": ["stylelint --fix", "prettier --write"],
}
