/**
 * Tokenize and normalize text for indexing and search.
 *
 * Implementation checklist:
 * 1. Convert to lowercase
 * 2. Split on whitespace and punctuation (keep alphanumeric and hyphens within words)
 * 3. Remove common English stopwords (the, a, an, is, are, was, were, be, been,
 *    being, have, has, had, do, does, did, will, would, could, should, may, might,
 *    can, shall, to, of, in, for, on, with, at, by, from, as, into, about, between,
 *    through, this, that, these, those, it, its, and, or, but, not, no, nor, so, yet)
 * 4. Filter out tokens shorter than 2 characters
 * 5. Return array of normalized tokens (may contain duplicates — TF needs them)
 */
export function tokenize(text: string): string[] {
  // TODO: Implement tokenization
  return [];
}

/**
 * Parse a search query into structured components.
 *
 * Supports:
 * - Regular terms: "redis cache" -> terms: ["redis", "cache"]
 * - Quoted phrases: '"rate limiting"' -> phrases: ["rate limiting"]
 * - Negated terms: "-redis" -> negations: ["redis"]
 * - Combinations: 'cache "rate limiting" -redis' -> terms: ["cache"], phrases: ["rate limiting"], negations: ["redis"]
 */
export interface ParsedQuery {
  terms: string[];
  phrases: string[];
  negations: string[];
}

export function parseQuery(query: string): ParsedQuery {
  // TODO: Implement query parsing
  return { terms: [], phrases: [], negations: [] };
}
