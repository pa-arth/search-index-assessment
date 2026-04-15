/** A document that can be indexed and searched */
export interface Document {
  id: string;
  title: string;
  body: string;
  tags: string[];
  category: string;
  /** Higher priority = boosted in results (1-10, default 1) */
  priority?: number;
  createdAt: string; // ISO date
}

/** Field-specific boost multipliers */
export interface FieldBoosts {
  title?: number; // default 3.0
  body?: number; // default 1.0
  tags?: number; // default 2.0
}

/** Filter criteria for narrowing results */
export interface SearchFilters {
  /** Only include documents in these categories */
  categories?: string[];
  /** Only include documents with ALL of these tags */
  tags?: string[];
  /** Only include documents created on or after this date */
  createdAfter?: string; // ISO date
  /** Only include documents created on or before this date */
  createdBefore?: string; // ISO date
}

/** Which fields to compute facet counts for */
export type FacetField = "category" | "tags";

/** Search options */
export interface SearchOptions {
  /** The search query string. Supports:
   *  - Single terms: "redis"
   *  - Multiple terms (OR logic): "redis cache"
   *  - Quoted phrases (exact match): '"rate limiting"'
   *  - Negation with minus: "cache -redis"
   */
  query: string;
  /** Filter results */
  filters?: SearchFilters;
  /** Field boost multipliers */
  boosts?: FieldBoosts;
  /** Compute facet counts for these fields */
  facets?: FacetField[];
  /** Max results to return (default 10) */
  limit?: number;
  /** Opaque cursor for pagination */
  cursor?: string;
}

/** A single search hit */
export interface SearchHit {
  document: Document;
  /** Relevance score (higher = more relevant) */
  score: number;
}

/** Facet count for a single value */
export interface FacetCount {
  value: string;
  count: number;
}

/** Search results */
export interface SearchResult {
  /** Matching documents, sorted by score descending */
  hits: SearchHit[];
  /** Total number of matching documents (before pagination) */
  total: number;
  /** Facet counts, keyed by field name */
  facets: Record<string, FacetCount[]>;
  /** Cursor for next page, null if no more results */
  nextCursor: string | null;
}
