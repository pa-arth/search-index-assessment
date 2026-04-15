import type {
  Document,
  SearchOptions,
  SearchResult,
  FieldBoosts,
} from "./types.js";

const DEFAULT_BOOSTS: Required<FieldBoosts> = {
  title: 3.0,
  body: 1.0,
  tags: 2.0,
};

export class SearchIndex {
  /**
   * Build the search index from a list of documents.
   *
   * Implementation checklist:
   * 1. Store documents by ID for retrieval
   * 2. Tokenize each document's title, body, and tags
   * 3. Build an inverted index: token -> list of { docId, field, positions }
   * 4. Compute document frequency (DF) for each token
   * 5. Store document lengths for TF normalization
   */
  constructor(documents: Document[]) {
    // TODO: Build the index
    void documents;
    void DEFAULT_BOOSTS;
  }

  /**
   * Search the index.
   *
   * Implementation checklist:
   * 1. Parse the query (terms, phrases, negations)
   * 2. For each term, look up matching documents from the inverted index
   * 3. Score each document using TF-IDF:
   *    - TF(term, doc, field) = count of term in field / total tokens in field
   *    - IDF(term) = log(totalDocs / docsContainingTerm)
   *    - Score += TF * IDF * fieldBoost  (for each field the term appears in)
   * 4. For phrase queries, verify terms appear consecutively in at least one field
   * 5. Exclude documents matching negated terms
   * 6. Apply filters (categories, tags, date range)
   * 7. Multiply score by document priority (if set, default 1)
   * 8. Sort by score descending, break ties by document ID ascending
   * 9. Compute facet counts on the FILTERED result set (before pagination)
   * 10. Apply pagination (limit + cursor)
   */
  search(options: SearchOptions): SearchResult {
    // TODO: Implement search
    void options;
    return {
      hits: [],
      total: 0,
      facets: {},
      nextCursor: null,
    };
  }
}
