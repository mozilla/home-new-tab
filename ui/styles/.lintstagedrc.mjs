/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  "*.css": ["stylelint --fix", "prettier --write"],
}
