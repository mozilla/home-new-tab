/**
 * Coarse interest scores by topic, derived from the user's local interaction
 * model. Sent to Merino as personalization context when the pipeline is active.
 * Keys are topic identifiers; values are affinity scores in [0, 1].
 */
export type InterestVector = Record<string, number>

/**
 * Scoring function the renderer injects into the discovery and spoc pipelines.
 *
 * Takes a corpus item ID and returns a relevance score — higher is better.
 * Applied after coordinator assembly, before renderer ranking.
 *
 * When not provided, items are ordered by their coordinator-assigned rank only.
 * This is the injection point for System B (inferred CTR) scoring.
 */
export type ScoreItem = (corpusItemId: string) => number
