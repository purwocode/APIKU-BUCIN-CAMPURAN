import { safeFetch } from "../safeFetch.js";
import { SANSEKAI_HEADERS } from "../headers.js";

const BASE = "https://api.sansekai.my.id/api/goodshort";
const GOODSHORT_TRENDING = `${BASE}/trending`;
const GOODSHORT_SEARCH = `${BASE}/search`;

const FETCH_OPTS = { headers: SANSEKAI_HEADERS, timeoutMs: 12000, retries: 2 };

/* ===============================
   HOME
=============================== */

export async function fetchGoodShortHome() {
  return safeFetch(GOODSHORT_TRENDING, FETCH_OPTS);
}

/**
 * Normalize GoodShort trending response.
 * Response: { data: { records: [ { name, items: [{bookId, bookName, cover, chapterCount, labels}] } ] } }
 */
export function normalizeGoodShortHome(json, unique) {
  const records = Array.isArray(json?.data?.records) ? json.data.records : [];
  return records
    .map((record) => {
      const items = unique(
        (Array.isArray(record.items) ? record.items : [])
          .filter((i) => i?.bookId && i?.bookName)
          .map((i) => ({
            _internalId: `goodshort_${i.bookId}`,
            source: "goodshort",
            id: i.bookId,
            title: i.bookName,
            cover: i.cover || null,
            description: i.introduction || null,
            episodes: i.chapterCount || null,
            tags: Array.isArray(i.labels) ? i.labels : [],
            viewCount: i.viewCount || null,
          }))
      );
      return items.length
        ? {
            id: `goodshort_${record.style || "rank"}`,
            title: record.name || "GoodShort",
            type: "goodshort",
            items,
          }
        : null;
    })
    .filter(Boolean);
}

/* ===============================
   SEARCH
=============================== */

export async function fetchGoodShortSearch(q) {
  return safeFetch(
    `${GOODSHORT_SEARCH}?query=${encodeURIComponent(q)}`,
    FETCH_OPTS
  );
}

/**
 * Normalize GoodShort search response.
 * Response: { data: { searchResult: { records: [{bookId, bookName, cover, introduction, chapterCount, labels}] } } }
 */
export function normalizeGoodShortSearch(json, map) {
  const records = Array.isArray(json?.data?.searchResult?.records)
    ? json.data.searchResult.records
    : [];
  records.forEach((i) => {
    const key = `goodshort_${i.bookId}`;
    if (!i.bookId || map.has(key)) return;
    map.set(key, {
      source: "goodshort",
      id: i.bookId,
      title: i.bookName,
      description: i.introduction || null,
      cover: i.cover || null,
      tags: Array.isArray(i.labels) ? i.labels : [],
      episodes: i.chapterCount || null,
    });
  });
}
