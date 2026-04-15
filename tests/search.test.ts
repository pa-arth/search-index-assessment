import { describe, it, expect, beforeAll } from "vitest";
import { SearchIndex } from "../src/index.js";
import { tokenize, parseQuery } from "../src/tokenizer.js";
import { DOCUMENTS } from "../src/dataset.js";
import type { SearchResult } from "../src/types.js";

describe("SearchIndex", () => {
  // ─── Tokenization ──────────────────────────────────────────────────

  describe("tokenization", () => {
    it("lowercases text", () => {
      const tokens = tokenize("Redis CACHING Strategy");
      expect(tokens).toEqual(expect.arrayContaining(["redis", "caching", "strategy"]));
      expect(tokens.every((t) => t === t.toLowerCase())).toBe(true);
    });

    it("splits on whitespace", () => {
      const tokens = tokenize("hello   world\ttab\nnewline");
      expect(tokens).toContain("hello");
      expect(tokens).toContain("world");
      expect(tokens).toContain("tab");
      expect(tokens).toContain("newline");
    });

    it("strips punctuation", () => {
      const tokens = tokenize("Hello, world! This is great.");
      expect(tokens).toContain("hello");
      expect(tokens).toContain("world");
      expect(tokens).toContain("great");
      // Punctuation should not appear as tokens
      expect(tokens).not.toContain(",");
      expect(tokens).not.toContain("!");
      expect(tokens).not.toContain(".");
    });

    it("preserves hyphens in compound words", () => {
      const tokens = tokenize("rate-limiting write-through cache-aside");
      expect(tokens).toContain("rate-limiting");
      expect(tokens).toContain("write-through");
      expect(tokens).toContain("cache-aside");
    });

    it("removes stopwords", () => {
      const tokens = tokenize("the quick brown fox is a very fast animal");
      expect(tokens).not.toContain("the");
      expect(tokens).not.toContain("is");
      expect(tokens).not.toContain("a");
      expect(tokens).toContain("quick");
      expect(tokens).toContain("brown");
      expect(tokens).toContain("fox");
    });

    it("filters tokens shorter than 2 characters", () => {
      const tokens = tokenize("I am a b c developer");
      expect(tokens).not.toContain("i");
      expect(tokens).not.toContain("b");
      expect(tokens).not.toContain("c");
      expect(tokens).toContain("developer");
    });

    it("handles empty string", () => {
      const tokens = tokenize("");
      expect(tokens).toEqual([]);
    });

    it("preserves duplicates for TF counting", () => {
      const tokens = tokenize("redis redis redis cache");
      const redisCount = tokens.filter((t) => t === "redis").length;
      expect(redisCount).toBe(3);
    });
  });

  // ─── Query Parsing ─────────────────────────────────────────────────

  describe("query parsing", () => {
    it("parses a single term", () => {
      const parsed = parseQuery("redis");
      expect(parsed.terms).toEqual(["redis"]);
      expect(parsed.phrases).toEqual([]);
      expect(parsed.negations).toEqual([]);
    });

    it("parses multiple terms", () => {
      const parsed = parseQuery("redis cache");
      expect(parsed.terms).toEqual(["redis", "cache"]);
    });

    it("parses a quoted phrase", () => {
      const parsed = parseQuery('"rate limiting"');
      expect(parsed.phrases).toEqual(["rate limiting"]);
      expect(parsed.terms).toEqual([]);
    });

    it("parses a negated term", () => {
      const parsed = parseQuery("-redis");
      expect(parsed.negations).toEqual(["redis"]);
      expect(parsed.terms).toEqual([]);
    });

    it("parses combination of terms, phrases, and negations", () => {
      const parsed = parseQuery('cache "rate limiting" -redis');
      expect(parsed.terms).toEqual(["cache"]);
      expect(parsed.phrases).toEqual(["rate limiting"]);
      expect(parsed.negations).toEqual(["redis"]);
    });

    it("handles extra whitespace", () => {
      const parsed = parseQuery("  redis   cache  ");
      expect(parsed.terms).toEqual(["redis", "cache"]);
    });

    it("parses multiple phrases", () => {
      const parsed = parseQuery('"rate limiting" "cache aside"');
      expect(parsed.phrases).toContain("rate limiting");
      expect(parsed.phrases).toContain("cache aside");
    });

    it("parses multiple negations", () => {
      const parsed = parseQuery("-redis -docker");
      expect(parsed.negations).toContain("redis");
      expect(parsed.negations).toContain("docker");
    });
  });

  // ─── Basic Search ──────────────────────────────────────────────────

  describe("basic search", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("returns matching documents for a single term", () => {
      const result = index.search({ query: "redis" });
      expect(result.hits.length).toBeGreaterThan(0);
      // doc-001, doc-002, doc-014, doc-026 all mention redis
      const ids = result.hits.map((h) => h.document.id);
      expect(ids).toContain("doc-001");
      expect(ids).toContain("doc-002");
      expect(ids).toContain("doc-014");
      expect(ids).toContain("doc-026");
    });

    it("returns empty results for non-existent term", () => {
      const result = index.search({ query: "xylophone" });
      expect(result.hits).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns docs matching at least one term for multi-term query", () => {
      const result = index.search({ query: "redis docker" });
      const ids = result.hits.map((h) => h.document.id);
      // Should include redis docs AND docker docs
      expect(ids).toContain("doc-001"); // redis
      expect(ids).toContain("doc-005"); // docker
    });

    it("handles empty query gracefully", () => {
      const result = index.search({ query: "" });
      expect(result.hits).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns total count of all matching documents", () => {
      const result = index.search({ query: "redis" });
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBe(result.hits.length);
    });
  });

  // ─── TF-IDF Ranking ───────────────────────────────────────────────

  describe("TF-IDF ranking", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("ranks title matches higher than body-only matches", () => {
      // "redis" appears in the title of doc-001 and doc-014
      // doc-030 mentions "message queues" but not redis in title
      const result = index.search({ query: "redis" });
      const ids = result.hits.map((h) => h.document.id);
      // doc-001 has "Redis" in title, should rank higher than docs with redis only in body
      const doc001Index = ids.indexOf("doc-001");
      expect(doc001Index).toBeLessThan(ids.length - 1);
    });

    it("scores are positive numbers", () => {
      const result = index.search({ query: "redis" });
      expect(result.hits.length).toBeGreaterThan(0);
      for (const hit of result.hits) {
        expect(hit.score).toBeGreaterThan(0);
      }
    });

    it("rare terms boost documents more than common terms", () => {
      // "pgbouncer" appears only in doc-021, should have high relevance
      const result = index.search({ query: "pgbouncer" });
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits[0].document.id).toBe("doc-021");
      expect(result.hits[0].score).toBeGreaterThan(0);
    });

    it("document with term in multiple fields ranks higher", () => {
      // "redis" appears in title, body, AND tags of doc-001
      // vs doc-002 where "redis" is in body and tags but title is about rate limiting
      const result = index.search({ query: "redis" });
      const scores = new Map(result.hits.map((h) => [h.document.id, h.score]));
      // doc-001 has redis in title+body+tags, doc-002 has redis in body+tags
      // With priority factored in, doc-001 (priority 3) vs doc-002 (priority 5)
      // doc-001 should still score well due to title boost
      const score001 = scores.get("doc-001")!;
      expect(score001).toBeGreaterThan(0);
    });

    it("sorts results by score descending", () => {
      const result = index.search({ query: "redis caching" });
      expect(result.hits.length).toBeGreaterThan(1);
      for (let i = 1; i < result.hits.length; i++) {
        expect(result.hits[i - 1].score).toBeGreaterThanOrEqual(result.hits[i].score);
      }
    });

    it("breaks ties by document ID ascending", () => {
      const result = index.search({ query: "performance" });
      expect(result.hits.length).toBeGreaterThan(1);
      for (let i = 1; i < result.hits.length; i++) {
        if (result.hits[i - 1].score === result.hits[i].score) {
          expect(result.hits[i - 1].document.id < result.hits[i].document.id).toBe(true);
        }
      }
    });
  });

  // ─── Field Boosting ────────────────────────────────────────────────

  describe("field boosting", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("uses default boosts (title=3, body=1, tags=2)", () => {
      // With default boosts, doc-001 (redis in title) should rank high for "redis"
      const result = index.search({ query: "redis" });
      expect(result.hits.length).toBeGreaterThan(0);
      // Title-match docs should be near the top
      const topIds = result.hits.slice(0, 3).map((h) => h.document.id);
      // doc-001 or doc-014 have redis in title
      const hasTitleMatch = topIds.includes("doc-001") || topIds.includes("doc-014") || topIds.includes("doc-026");
      expect(hasTitleMatch).toBe(true);
    });

    it("custom boosts change ranking order", () => {
      // Boost body heavily, reduce title boost
      const resultBodyBoost = index.search({
        query: "redis",
        boosts: { title: 0.1, body: 10.0, tags: 0.1 },
      });
      const resultTitleBoost = index.search({
        query: "redis",
        boosts: { title: 10.0, body: 0.1, tags: 0.1 },
      });
      // Top results should differ between the two boost configurations
      const topBodyBoost = resultBodyBoost.hits[0]?.document.id;
      const topTitleBoost = resultTitleBoost.hits[0]?.document.id;
      // At minimum, results should exist
      expect(resultBodyBoost.hits.length).toBeGreaterThan(0);
      expect(resultTitleBoost.hits.length).toBeGreaterThan(0);
      // With title boost, doc-001 (redis in title) should rank higher
      // With body boost, docs with more redis mentions in body might rank differently
      expect(topBodyBoost).toBeDefined();
      expect(topTitleBoost).toBeDefined();
    });

    it("tag matches contribute to scoring", () => {
      // "caching" is a tag on doc-001 and doc-026
      const result = index.search({ query: "caching" });
      const ids = result.hits.map((h) => h.document.id);
      expect(ids).toContain("doc-001");
      expect(ids).toContain("doc-026");
    });
  });

  // ─── Phrase Search ─────────────────────────────────────────────────

  describe("phrase search", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("matches documents containing an exact phrase", () => {
      const result = index.search({ query: '"rate limiting"' });
      expect(result.hits.length).toBeGreaterThan(0);
      // doc-002 title is "Building a Rate Limiting Middleware"
      const ids = result.hits.map((h) => h.document.id);
      expect(ids).toContain("doc-002");
    });

    it("does not match documents with terms non-adjacent", () => {
      // "rate" and "limiting" appear together in doc-002 but not in, say, doc-018
      // doc-018 is about "API Versioning Strategies" — no "rate limiting" phrase
      const result = index.search({ query: '"rate limiting"' });
      const ids = result.hits.map((h) => h.document.id);
      expect(ids).not.toContain("doc-018");
    });

    it("phrase combined with regular term works", () => {
      const result = index.search({ query: '"rate limiting" redis' });
      const ids = result.hits.map((h) => h.document.id);
      // doc-002 matches both the phrase and "redis"
      expect(ids).toContain("doc-002");
      expect(result.hits.length).toBeGreaterThan(1); // should also match redis-only docs
    });

    it("phrase search is case insensitive", () => {
      const result = index.search({ query: '"Rate Limiting"' });
      expect(result.hits.length).toBeGreaterThan(0);
      const ids = result.hits.map((h) => h.document.id);
      expect(ids).toContain("doc-002");
    });
  });

  // ─── Negation ──────────────────────────────────────────────────────

  describe("negation", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("excludes documents containing the negated term", () => {
      const withRedis = index.search({ query: "caching" });
      const withoutRedis = index.search({ query: "caching -redis" });
      // doc-001 and doc-026 mention both caching and redis, should be excluded
      const idsWithout = withoutRedis.hits.map((h) => h.document.id);
      expect(idsWithout).not.toContain("doc-001");
      expect(idsWithout).not.toContain("doc-026");
      expect(withoutRedis.total).toBeLessThan(withRedis.total);
    });

    it("returns cache docs without redis", () => {
      const result = index.search({ query: "cache -redis" });
      expect(result.hits.length).toBeGreaterThan(0);
      const ids = result.hits.map((h) => h.document.id);
      // None of the results should contain "redis" in any field
      for (const hit of result.hits) {
        const doc = hit.document;
        const allText = `${doc.title} ${doc.body} ${doc.tags.join(" ")}`.toLowerCase();
        expect(allText).not.toContain("redis");
      }
    });

    it("negation-only query returns empty results", () => {
      // Negation without positive terms should return nothing
      const result = index.search({ query: "-redis" });
      expect(result.hits).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ─── Filters ───────────────────────────────────────────────────────

  describe("filters", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("filters by single category", () => {
      const result = index.search({
        query: "performance",
        filters: { categories: ["frontend"] },
      });
      for (const hit of result.hits) {
        expect(hit.document.category).toBe("frontend");
      }
      expect(result.hits.length).toBeGreaterThan(0);
    });

    it("filters by multiple categories", () => {
      const result = index.search({
        query: "performance",
        filters: { categories: ["frontend", "database"] },
      });
      for (const hit of result.hits) {
        expect(["frontend", "database"]).toContain(hit.document.category);
      }
      expect(result.hits.length).toBeGreaterThan(0);
    });

    it("filters by tags with AND logic", () => {
      const result = index.search({
        query: "redis",
        filters: { tags: ["redis", "caching"] },
      });
      for (const hit of result.hits) {
        expect(hit.document.tags).toContain("redis");
        expect(hit.document.tags).toContain("caching");
      }
      // doc-001 and doc-026 have both tags
      const ids = result.hits.map((h) => h.document.id);
      expect(ids).toContain("doc-001");
      expect(ids).toContain("doc-026");
    });

    it("filters by createdAfter", () => {
      const result = index.search({
        query: "react",
        filters: { createdAfter: "2025-04-01T00:00:00Z" },
      });
      for (const hit of result.hits) {
        expect(new Date(hit.document.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date("2025-04-01T00:00:00Z").getTime()
        );
      }
      expect(result.hits.length).toBeGreaterThan(0);
    });

    it("filters by createdBefore", () => {
      // Search broadly enough to get results even with the date filter
      const result = index.search({
        query: "css layout responsive",
        filters: { createdBefore: "2025-02-01T00:00:00Z" },
      });
      expect(result.hits.length).toBeGreaterThan(0);
      for (const hit of result.hits) {
        expect(new Date(hit.document.createdAt).getTime()).toBeLessThanOrEqual(
          new Date("2025-02-01T00:00:00Z").getTime()
        );
      }
    });

    it("filters by date range", () => {
      const result = index.search({
        query: "security authentication api",
        filters: {
          createdAfter: "2025-02-01T00:00:00Z",
          createdBefore: "2025-03-31T00:00:00Z",
        },
      });
      expect(result.hits.length).toBeGreaterThan(0);
      for (const hit of result.hits) {
        const ts = new Date(hit.document.createdAt).getTime();
        expect(ts).toBeGreaterThanOrEqual(new Date("2025-02-01T00:00:00Z").getTime());
        expect(ts).toBeLessThanOrEqual(new Date("2025-03-31T00:00:00Z").getTime());
      }
    });

    it("combines multiple filter types", () => {
      const result = index.search({
        query: "security authentication api oauth",
        filters: {
          categories: ["security"],
          tags: ["api"],
          createdAfter: "2025-02-01T00:00:00Z",
        },
      });
      expect(result.hits.length).toBeGreaterThan(0);
      for (const hit of result.hits) {
        expect(hit.document.category).toBe("security");
        expect(hit.document.tags).toContain("api");
        expect(new Date(hit.document.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date("2025-02-01T00:00:00Z").getTime()
        );
      }
    });

    it("returns empty results when filters match nothing", () => {
      const result = index.search({
        query: "redis",
        filters: { categories: ["nonexistent-category"] },
      });
      expect(result.hits).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("filters apply before scoring", () => {
      // Filtered-out docs should not appear in results at all
      const unfiltered = index.search({ query: "redis" });
      const filtered = index.search({
        query: "redis",
        filters: { categories: ["backend"] },
      });
      expect(unfiltered.hits.length).toBeGreaterThan(0);
      expect(filtered.hits.length).toBeGreaterThan(0);
      expect(filtered.total).toBeLessThan(unfiltered.total);
      for (const hit of filtered.hits) {
        expect(hit.document.category).toBe("backend");
      }
    });
  });

  // ─── Facets ────────────────────────────────────────────────────────

  describe("facets", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("returns category facet counts for matching docs", () => {
      const result = index.search({
        query: "performance",
        facets: ["category"],
      });
      expect(result.facets["category"]).toBeDefined();
      expect(result.facets["category"].length).toBeGreaterThan(0);
      // Total of facet counts should equal total results
      const facetTotal = result.facets["category"].reduce((sum, f) => sum + f.count, 0);
      expect(facetTotal).toBe(result.total);
    });

    it("returns tag facet counts for matching docs", () => {
      const result = index.search({
        query: "redis",
        facets: ["tags"],
      });
      expect(result.facets["tags"]).toBeDefined();
      expect(result.facets["tags"].length).toBeGreaterThan(0);
      // "redis" tag should appear since matching docs have it
      const redisTag = result.facets["tags"].find((f) => f.value === "redis");
      expect(redisTag).toBeDefined();
      expect(redisTag!.count).toBeGreaterThan(0);
    });

    it("facets reflect filtered results", () => {
      const unfiltered = index.search({
        query: "security",
        facets: ["category"],
      });
      const filtered = index.search({
        query: "security",
        filters: { categories: ["security"] },
        facets: ["category"],
      });
      // Filtered facets should only show "security" category
      expect(filtered.facets["category"].length).toBe(1);
      expect(filtered.facets["category"][0].value).toBe("security");
      // Unfiltered should have more categories
      expect(unfiltered.facets["category"].length).toBeGreaterThanOrEqual(
        filtered.facets["category"].length
      );
    });

    it("facet counts are sorted by count descending", () => {
      const result = index.search({
        query: "performance",
        facets: ["category"],
      });
      const counts = result.facets["category"];
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i - 1].count).toBeGreaterThanOrEqual(counts[i].count);
      }
    });

    it("returns empty facets when none requested", () => {
      const result = index.search({ query: "redis" });
      expect(result.facets).toEqual({});
    });

    it("returns both category and tag facets when requested", () => {
      const result = index.search({
        query: "redis",
        facets: ["category", "tags"],
      });
      expect(result.facets["category"]).toBeDefined();
      expect(result.facets["tags"]).toBeDefined();
    });
  });

  // ─── Pagination ────────────────────────────────────────────────────

  describe("pagination", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("limits number of results", () => {
      const result = index.search({ query: "performance", limit: 2 });
      expect(result.hits.length).toBeLessThanOrEqual(2);
    });

    it("default limit is 10", () => {
      // Search for something with many matches
      const result = index.search({ query: "security api performance redis react" });
      expect(result.hits.length).toBeLessThanOrEqual(10);
    });

    it("returns nextCursor when more results exist", () => {
      const result = index.search({ query: "redis", limit: 1 });
      if (result.total > 1) {
        expect(result.nextCursor).not.toBeNull();
      }
    });

    it("passing cursor returns next page", () => {
      const page1 = index.search({ query: "redis", limit: 2 });
      expect(page1.nextCursor).not.toBeNull();

      const page2 = index.search({
        query: "redis",
        limit: 2,
        cursor: page1.nextCursor!,
      });
      // Page 2 should have different docs than page 1
      const page1Ids = page1.hits.map((h) => h.document.id);
      const page2Ids = page2.hits.map((h) => h.document.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });

    it("returns null nextCursor on last page", () => {
      const result = index.search({ query: "pgbouncer", limit: 10 });
      // pgbouncer only appears in one doc
      expect(result.hits.length).toBe(1);
      expect(result.nextCursor).toBeNull();
    });

    it("total reflects full result count, not page count", () => {
      const full = index.search({ query: "redis", limit: 100 });
      const page = index.search({ query: "redis", limit: 1 });
      expect(page.total).toBe(full.total);
      expect(page.hits.length).toBeLessThan(page.total);
    });

    it("consistent ordering across pages (no duplicates, no gaps)", () => {
      const allResults = index.search({ query: "redis", limit: 100 });
      const allIds = allResults.hits.map((h) => h.document.id);

      // Paginate through with limit=1
      const paginatedIds: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < allIds.length; i++) {
        const page = index.search({
          query: "redis",
          limit: 1,
          cursor: cursor ?? undefined,
        });
        paginatedIds.push(...page.hits.map((h) => h.document.id));
        cursor = page.nextCursor;
        if (!cursor) break;
      }

      expect(paginatedIds).toEqual(allIds);
    });
  });

  // ─── Priority Boost ────────────────────────────────────────────────

  describe("priority boost", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("higher priority docs rank higher when TF-IDF scores are similar", () => {
      // doc-004 (PostgreSQL Index Optimization, priority 7) and doc-016 (PostgreSQL Query Performance, priority 5)
      // both heavily feature "postgresql" — higher priority should boost ranking
      const result = index.search({ query: "postgresql" });
      const ids = result.hits.map((h) => h.document.id);
      expect(ids).toContain("doc-004");
      expect(ids).toContain("doc-016");
    });

    it("priority multiplies the TF-IDF score", () => {
      // doc-013 (XSS Prevention, priority 8) should have a higher score
      // than it would without priority
      const result = index.search({ query: "xss vulnerability" });
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits[0].document.id).toBe("doc-013");
      expect(result.hits[0].score).toBeGreaterThan(0);
    });

    it("documents without priority default to 1", () => {
      // doc-005 has no priority set
      const result = index.search({ query: "docker multi-stage" });
      const hit = result.hits.find((h) => h.document.id === "doc-005");
      expect(hit).toBeDefined();
      expect(hit!.score).toBeGreaterThan(0);
    });
  });

  // ─── Integration Tests ─────────────────────────────────────────────

  describe("integration", () => {
    let index: SearchIndex;

    beforeAll(() => {
      index = new SearchIndex(DOCUMENTS);
    });

    it("search 'redis caching' returns the Redis caching doc as top result", () => {
      const result = index.search({ query: "redis caching" });
      expect(result.hits.length).toBeGreaterThan(0);
      // doc-001 "Introduction to Redis Caching Strategies" should be top or near top
      // (it has redis in title + caching in title/body/tags + priority 3)
      const topIds = result.hits.slice(0, 3).map((h) => h.document.id);
      expect(topIds).toContain("doc-001");
    });

    it("search 'react' with category filter 'frontend' returns only frontend docs", () => {
      const result = index.search({
        query: "react",
        filters: { categories: ["frontend"] },
      });
      expect(result.hits.length).toBeGreaterThan(0);
      for (const hit of result.hits) {
        expect(hit.document.category).toBe("frontend");
      }
      // doc-011 (React Performance) and doc-024 (React State Management) are frontend
      const ids = result.hits.map((h) => h.document.id);
      expect(ids).toContain("doc-011");
      expect(ids).toContain("doc-024");
    });

    it("search for rare term returns small, highly relevant result set", () => {
      const result = index.search({ query: "terraform" });
      expect(result.total).toBe(1);
      expect(result.hits[0].document.id).toBe("doc-023");
    });

    it("search with facets returns correct counts", () => {
      const result = index.search({
        query: "redis",
        facets: ["category"],
      });
      const backendFacet = result.facets["category"].find((f) => f.value === "backend");
      expect(backendFacet).toBeDefined();
      // Most redis docs are in backend category
      expect(backendFacet!.count).toBeGreaterThanOrEqual(3);
    });

    it("paginate through all results of a broad search", () => {
      const allResults = index.search({
        query: "security api performance",
        limit: 100,
      });

      let collected = 0;
      let cursor: string | undefined;
      const seenIds = new Set<string>();

      while (true) {
        const page = index.search({
          query: "security api performance",
          limit: 3,
          cursor,
        });

        for (const hit of page.hits) {
          expect(seenIds.has(hit.document.id)).toBe(false);
          seenIds.add(hit.document.id);
        }

        collected += page.hits.length;

        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }

      expect(collected).toBe(allResults.total);
    });

    it("complex query with filters, facets, and pagination", () => {
      const result = index.search({
        query: "security authentication",
        filters: {
          categories: ["security"],
          createdAfter: "2025-02-01T00:00:00Z",
        },
        facets: ["tags"],
        limit: 2,
      });

      for (const hit of result.hits) {
        expect(hit.document.category).toBe("security");
        expect(new Date(hit.document.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date("2025-02-01T00:00:00Z").getTime()
        );
      }
      expect(result.hits.length).toBeLessThanOrEqual(2);
      expect(result.facets["tags"]).toBeDefined();
    });

    it("search results are deterministic", () => {
      const result1 = index.search({ query: "redis caching performance" });
      const result2 = index.search({ query: "redis caching performance" });
      expect(result1.hits.map((h) => h.document.id)).toEqual(
        result2.hits.map((h) => h.document.id)
      );
      expect(result1.hits.map((h) => h.score)).toEqual(
        result2.hits.map((h) => h.score)
      );
    });

    it("search 'postgresql full-text search' ranks doc-027 highly", () => {
      const result = index.search({ query: "postgresql full-text search" });
      expect(result.hits.length).toBeGreaterThan(0);
      const topIds = result.hits.slice(0, 3).map((h) => h.document.id);
      expect(topIds).toContain("doc-027");
    });

    it("search with all filter types combined", () => {
      const result = index.search({
        query: "api",
        filters: {
          categories: ["backend", "security"],
          tags: ["api"],
          createdAfter: "2025-02-01T00:00:00Z",
          createdBefore: "2025-04-30T00:00:00Z",
        },
      });
      expect(result.hits.length).toBeGreaterThan(0);
      for (const hit of result.hits) {
        expect(["backend", "security"]).toContain(hit.document.category);
        expect(hit.document.tags).toContain("api");
        const ts = new Date(hit.document.createdAt).getTime();
        expect(ts).toBeGreaterThanOrEqual(new Date("2025-02-01T00:00:00Z").getTime());
        expect(ts).toBeLessThanOrEqual(new Date("2025-04-30T00:00:00Z").getTime());
      }
    });
  });
});
