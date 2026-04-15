# Search Index with Ranking

## Background
Your team is building a documentation search feature. The API layer and UI are done — your job is to implement the **search engine core**: an in-memory inverted index with TF-IDF ranking, field boosting, filtering, facets, and pagination.

## What's provided
- `src/types.ts` — Complete type definitions (read these first)
- `src/dataset.ts` — 30 documents to index (don't modify)
- `tests/search.test.ts` — Test suite (your target: make all tests pass)

## What you'll build

### 1. Tokenizer (`src/tokenizer.ts`)
- `tokenize(text)` — lowercase, split on whitespace/punctuation, remove stopwords, filter short tokens
- `parseQuery(query)` — parse search queries into terms, quoted phrases, and negations

### 2. Search Index (`src/index.ts`)
- `constructor(documents)` — build an inverted index from the documents
- `search(options)` — query the index and return ranked results

### Scoring: TF-IDF with field boosting
For each term in the query, for each document containing that term:

```
TF(term, doc, field) = occurrences of term in field / total tokens in field
IDF(term) = log(totalDocs / docsContainingTerm)
fieldScore = TF * IDF * fieldBoost
```

Sum scores across all query terms and all fields. Multiply final score by `document.priority` (default 1).

Default field boosts: title=3.0, body=1.0, tags=2.0.

### Query syntax
| Syntax | Meaning | Example |
|--------|---------|---------|
| `word` | Match documents containing this term | `redis` |
| `word1 word2` | Match documents containing either term (OR) | `redis cache` |
| `"phrase"` | Match exact phrase (consecutive terms) | `"rate limiting"` |
| `-word` | Exclude documents containing this term | `-redis` |

### Filtering
Filters narrow the result set BEFORE scoring:
- `categories` — document must be in one of the listed categories
- `tags` — document must have ALL listed tags
- `createdAfter` / `createdBefore` — date range filter

### Facets
Facet counts are computed on the filtered+matched result set (before pagination). Return counts sorted by count descending.

### Pagination
- Default limit: 10
- Cursor-based: encode enough state to resume from the next position
- `total` reflects the full matched count, not the page size
- `nextCursor` is null on the last page

### Tie-breaking
When scores are equal, sort by document ID ascending.

## Success criteria
- All tests pass (`npm test`)
- Search results are deterministic
- No hardcoded values or test-specific hacks

## Setup
```bash
npm install
npm test        # see failing tests
```

## Time estimate
~60 minutes
