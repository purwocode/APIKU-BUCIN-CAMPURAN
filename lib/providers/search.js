import { safeFetch } from "../safeFetch.js";
import { SEARCH_HEADERS, REELSHORT_HEADERS } from "../headers.js";
import { fetchGoodShortSearch, normalizeGoodShortSearch } from "./goodshort.js";
import { fetchShortmaxSearch, normalizeShortmaxSearch } from "./shortmax.js";

/* ===============================
   API ENDPOINTS
=============================== */
const DRAMABOX_SEARCH = "https://dramabox.sansekai.my.id/api/dramabox/search";
const NETSHORT_SEARCH = "https://netshort.sansekai.my.id/api/netshort/search";
const MELOLO_SEARCH = "https://melolo-api-azure.vercel.app/api/melolo/search";
const FLICKREELS_SEARCH = "https://api.sansekai.my.id/api/flickreels/search";
const DRAMAWAVE_SEARCH = "https://dramabos.asia/api/dramawave/api/search";
const REELSHORT_SEARCH = "https://api.sansekai.my.id/api/reelshort/search";

/* ===============================
   GOODSHORT — imported from goodshort.js
=============================== */

/* ===============================
   NORMALIZERS
=============================== */

function normalizeDramabox(json, map) {
  if (!Array.isArray(json)) return;
  json.forEach((item) => {
    const key = `dramabox_${item.bookId}`;
    if (!item.bookId || map.has(key)) return;
    map.set(key, {
      source: "dramabox",
      id: item.bookId,
      title: item.bookName,
      description: item.introduction,
      cover: item.cover,
      tags: item.tagNames || [],
      vip: item.corner?.cornerType === 4,
    });
  });
}

function normalizeNetshort(json, map) {
  (json?.searchCodeSearchResult || []).forEach((item) => {
    const key = `netshort_${item.shortPlayId}`;
    if (!item.shortPlayId || map.has(key)) return;
    map.set(key, {
      source: "netshort",
      id: item.shortPlayId,
      title: item.shortPlayName?.replace(/<[^>]+>/g, ""),
      description: item.shotIntroduce,
      cover: item.shortPlayCover,
      tags: item.labelNameList || [],
      heat: item.formatHeatScore,
    });
  });
}

function normalizeMelolo(json, map) {
  (json?.data?.search_data || []).forEach((group) => {
    (group.books || []).forEach((book) => {
      const key = `melolo_${book.book_id}`;
      if (!book.book_id || map.has(key)) return;
      map.set(key, {
        source: "melolo",
        id: book.book_id,
        title: book.book_name,
        description: book.abstract,
        cover: book.thumb_url,
        author: book.author,
        tags: book.stat_infos || [],
        episodes: Number(book.serial_count),
        isNew: book.is_new_book === "1",
        isHot: book.is_hot === "1",
        status: book.show_creation_status,
        ageGate: book.age_gate,
      });
    });
  });
}

function normalizeFlickreels(json, map) {
  if (!Array.isArray(json?.data)) return;
  json.data.forEach((item) => {
    const key = `flickreels_${item.playlet_id}`;
    if (!item.playlet_id || map.has(key)) return;
    map.set(key, {
      source: "flickreels",
      id: Number(item.playlet_id),
      title: item.title,
      description: item.introduce,
      cover: item.cover,
      episodes: item.upload_num,
      tags: Array.isArray(item.tag_list)
        ? item.tag_list.map((t) => t.tag_name).filter(Boolean)
        : [],
    });
  });
}

function normalizeDramawave(json, map) {
  if (!Array.isArray(json?.data)) return;
  json.data.forEach((item) => {
    const key = `dramawave_${item.id}`;
    if (!item.id || map.has(key)) return;

    const tags = [
      ...(Array.isArray(item.series_tag) ? item.series_tag : []),
      ...(Array.isArray(item.content_tags) ? item.content_tags : []),
    ]
      .filter(Boolean)
      .map((t) => String(t).replace(/{{|}}/g, ""))
      .filter((t, i, a) => a.indexOf(t) === i);

    map.set(key, {
      source: "dramawave",
      id: item.id,
      title: item.name || item.title,
      description: item.desc,
      cover: item.cover,
      episodes: item.episode_count,
      viewCount: item.view_count,
      followCount: item.follow_count,
      commentCount: item.comment_count,
      tags,
    });
  });
}

function normalizeReelshort(json, map) {
  if (!Array.isArray(json?.results)) return;
  json.results.forEach((item) => {
    const key = `reelshort_${item.bookId}`;
    if (!item.bookId || map.has(key)) return;
    map.set(key, {
      source: "reelshort",
      id: item.bookId,
      title: item.title,
      description: item.description,
      cover: item.cover,
      tags: item.tag || [],
      episodes: item.chapterCount,
    });
  });
}

/* ===============================
   MAIN EXPORT
=============================== */

/**
 * Fetch hasil pencarian dari semua provider secara paralel.
 * @param {string} q  — kata kunci pencarian
 * @returns {Promise<object>}
 */
export async function fetchSearchResults(q) {
  const opts = { headers: SEARCH_HEADERS, timeoutMs: 12000, retries: 1 };
  const rsOpts = { headers: REELSHORT_HEADERS, timeoutMs: 12000, retries: 1 };

  const [dbJson, nsJson, mlJson, frJson, dwJson, rsJson, gsJson, smJson] = await Promise.all([
    safeFetch(`${DRAMABOX_SEARCH}?query=${encodeURIComponent(q)}`, opts),
    safeFetch(`${NETSHORT_SEARCH}?query=${encodeURIComponent(q)}`, opts),
    safeFetch(`${MELOLO_SEARCH}?query=${encodeURIComponent(q)}&limit=10&offset=0`, opts),
    safeFetch(`${FLICKREELS_SEARCH}?query=${encodeURIComponent(q)}`, opts),
    safeFetch(`${DRAMAWAVE_SEARCH}?lang=in&q=${encodeURIComponent(q)}&page=1`, {
      ...opts,
      timeoutMs: 15000,
    }),
    safeFetch(`${REELSHORT_SEARCH}?query=${encodeURIComponent(q)}&page=1`, rsOpts),
    fetchGoodShortSearch(q),
    fetchShortmaxSearch(q),
  ]);

  const map = new Map();
  normalizeDramabox(dbJson, map);
  normalizeNetshort(nsJson, map);
  normalizeMelolo(mlJson, map);
  normalizeFlickreels(frJson, map);
  normalizeDramawave(dwJson, map);
  normalizeReelshort(rsJson, map);
  normalizeGoodShortSearch(gsJson, map);
  normalizeShortmaxSearch(smJson, map);

  const results = Array.from(map.values());
  return {
    query: q,
    total: results.length,
    results,
    sourceFailed: {
      dramabox: dbJson === null,
      netshort: nsJson === null,
      melolo: mlJson === null,
      flickreels: frJson === null,
      dramawave: dwJson === null,
      reelshort: rsJson === null,
      goodshort: gsJson === null,
      shortmax: smJson === null,
    },
  };
}
