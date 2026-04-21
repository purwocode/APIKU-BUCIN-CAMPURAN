import { safeFetch, mapLimit } from "../safeFetch.js";
import { REELSHORT_HEADERS, REELSHORT_HOME_HEADERS } from "../headers.js";

const REELSHORT_BASE = "https://api.sansekai.my.id/api/reelshort";
const REELSHORT_HOMEPAGE = `${REELSHORT_BASE}/homepage`;
const REELSHORT_DETAIL = `${REELSHORT_BASE}/detail`;
const REELSHORT_EPISODE = `${REELSHORT_BASE}/episode`;

const FETCH_OPTS = { headers: REELSHORT_HEADERS, timeoutMs: 15000, retries: 2 };
const HOME_FETCH_OPTS = { headers: REELSHORT_HOME_HEADERS, timeoutMs: 15000, retries: 2 };

/* ===============================
   EPISODE
=============================== */

/**
 * Resolve video URL untuk satu episode.
 * @param {string} bookId
 * @param {number} episodeNumber
 * @returns {Promise<object[]>}  array videos
 */
async function resolveEpisodeVideos(bookId, episodeNumber) {
  const json = await safeFetch(
    `${REELSHORT_EPISODE}?bookId=${bookId}&episodeNumber=${episodeNumber}`,
    { headers: REELSHORT_HEADERS, timeoutMs: 10000, retries: 1 }
  );
  if (!json?.videoList?.length) return [];
  return json.videoList.map((v) => ({
    quality: v.quality || 0,
    encode: v.encode,
    url: v.url,
    vip: json.isLocked === true,
  }));
}

/**
 * Fetch semua episode dari ReelShort.
 * Gunakan /detail untuk daftar chapter, lalu resolve video tiap episode (throttle 5).
 * @param {string} id  — bookId
 * @returns {Promise<object|null>}  null jika tidak match / error
 */
export async function fetchReelshortEpisodes(id) {
  try {
    const detail = await safeFetch(`${REELSHORT_DETAIL}?bookId=${id}`, FETCH_OPTS);

    if (!detail?.bookId || !Array.isArray(detail?.chapters) || detail.chapters.length === 0) {
      return null;
    }

    const episodes = await mapLimit(detail.chapters, 5, async (ch) => {
      const videos = await resolveEpisodeVideos(id, ch.serialNumber ?? ch.index);
      return {
        id: ch.chapterId,
        episode: ch.serialNumber ?? ch.index,
        title: ch.title || `EP ${ch.serialNumber ?? ch.index}`,
        thumbnail: null,
        vip: ch.isLocked === true,
        subtitle: [],
        videos,
      };
    });

    return {
      source: "reelshort",
      id,
      title: detail.title,
      cover: detail.cover,
      description: detail.description,
      totalEpisode: detail.totalEpisodes ?? episodes.length,
      episodes,
    };
  } catch (err) {
    console.error("[reelshort] ERROR:", err);
    return null;
  }
}

/* ===============================
   HOME
=============================== */

/**
 * Fetch data homepage dari ReelShort.
 * @returns {Promise<object|null>}  null jika gagal
 */
export async function fetchReelshortHome() {
  try {
    const json = await safeFetch(REELSHORT_HOMEPAGE, HOME_FETCH_OPTS);
    return json ?? null;
  } catch (err) {
    console.error("[reelshort-home] ERROR:", err);
    return null;
  }
}

/**
 * Normalisasi response homepage ReelShort menjadi sections.
 * Mendukung struktur columnVoList (sama seperti DramaBox).
 * @param {object|null} json
 * @param {Function} unique  — dedup function dari makeDedup()
 * @returns {object[]}
 */
export function normalizeReelshortHome(json, unique) {
  if (Array.isArray(json?.data?.lists)) {
    return json.data.lists
      .map((section, index) => {
        const items = unique(
          (section.books || []).map((b) => ({
            _internalId: `reelshort_${b.book_id || b.bookId}`,
            source: "reelshort",
            id: b.book_id || b.bookId || b.t_book_id,
            title: b.book_title || b.bookName || b.title,
            cover: b.book_pic || b.coverWap || b.cover,
            description: b.special_desc || null,
            tags: Array.isArray(b.theme)
              ? b.theme
              : Array.isArray(b.tag_list)
                ? b.tag_list.map((tag) => tag.tag_name).filter(Boolean)
                : [],
            episodes: b.chapter_count || b.chapterCount,
            playCount: b.read_count || b.playCount,
            vip: false,
            isNew: b.is_new === 1,
          }))
        );

        return items.length
          ? {
              id: `reelshort_list_${section.tab_id || section.bs_id || index}`,
              title: `ReelShort ${index + 1}`,
              type: "reelshort",
              items,
            }
          : null;
      })
      .filter(Boolean);
  }

  // Struktur kemungkinan: { columnVoList: [{ columnId, title, bookList: [...] }] }
  if (Array.isArray(json?.columnVoList)) {
    return json.columnVoList
      .map((col) => {
        const items = unique(
          (col.bookList || []).map((b) => ({
            _internalId: `reelshort_${b.bookId}`,
            source: "reelshort",
            id: b.bookId,
            title: b.bookName,
            cover: b.coverWap || b.cover,
            tags: b.tags || [],
            episodes: b.chapterCount,
            playCount: b.playCount,
            vip: Boolean(b.corner),
          }))
        );
        return items.length
          ? { id: `reelshort_${col.columnId}`, title: col.title, type: "reelshort", items }
          : null;
      })
      .filter(Boolean);
  }

  // Fallback: array langsung
  if (Array.isArray(json)) {
    const items = unique(
      json.map((b) => ({
        _internalId: `reelshort_${b.bookId || b.id}`,
        source: "reelshort",
        id: b.bookId || b.id,
        title: b.bookName || b.title,
        cover: b.coverWap || b.cover,
        tags: b.tags || [],
        episodes: b.chapterCount,
        vip: Boolean(b.corner),
      }))
    );
    return items.length
      ? [{ id: "reelshort_home", title: "🎬 ReelShort", type: "reelshort", items }]
      : [];
  }

  return [];
}
