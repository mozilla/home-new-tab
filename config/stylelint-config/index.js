/** @type {import('stylelint').Config} */

module.exports = {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-order"],
  rules: {
    "color-hex-length": "long",
    "declaration-empty-line-before": null,
    "order/properties-alphabetical-order": true,
    "selector-class-pattern": null,
    "selector-pseudo-class-no-unknown": [
      true,
      { ignorePseudoClasses: ["global", "has", "is", "where"] },
    ],
    "no-descending-specificity": null,
    "at-rule-no-unknown": [
      true,
      { ignoreAtRules: ["define-mixin", "mixin", "layer"] },
    ],
  },
}
