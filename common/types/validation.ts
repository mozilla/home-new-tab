export type ValidationLayer = "structural" | "identity" | "policy"

export type ValidationFailure = {
  /** Which validation layer caught the failure. */
  layer: ValidationLayer
  /** Machine-readable failure reason. */
  rule: string
  /** Human-readable explanation of what went wrong. */
  message: string
  /** Which artifact is involved, if applicable. */
  artifact?: string
  /** Diagnostic context (file paths, expected vs actual, etc.). */
  detail?: unknown
}
