import { safeFetch, mapLimit } from "../safeFetch.js";
import {
  HOME_DEFAULT_HEADERS,
  HOME_MELOLO_HEADERS,
} from "../headers.js";
import { fetchReelshortHome, normalizeReelshortHome } from "./reelshort.js";
import { fetchFreeReelsHome, normalizeFreeReelsHome } from "./freereels.js";
import { fetchGoodShortHome, normalizeGoodShortHome } from "./goodshort.js";
import { fetchDramaNovaHome, normalizeDramaNovaHome } from "./dramanova.js";
import { fetchShortmaxHome, normalizeShortmaxHome } from "./shortmax.js";

/* ===============================
   API ENDPOINTS
=============================== */
const THEATER_API = "https://netshort.sansekai.my.id/api/netshort/theaters";

const DRAMABOX_APIS = {
  vip: "https://api.sansekai.my.id/api/dramabox/vip",
  dubindo: "https://api.sansekai.my.id/api/dramabox/dubindo?classify=terpopuler",
  random: "https://api.sansekai.my.id/api/dramabox/randomdrama",
  latest: "https://api.sansekai.my.id/api/dramabox/latest",
  trending: "https://api.sansekai.my.id/api/dramabox/trending",
  populersearch: "https://api.sansekai.my.id/api/dramabox/populersearch",
};

const MELOLO_APIS = {
  latest: "https://melolo-api-azure.vercel.app/api/melolo/latest",
  trending: "https://melolo-api-azure.vercel.app/api/melolo/trending",
};

const FLICKREELS_APIS = {
  latest: "https://api.sansekai.my.id/api/flickreels/latest",
  hotrank: "https://api.sansekai.my.id/api/flickreels/hotrank",
};

const DRAMAWAVE_API = "https://dramabos.asia/api/dramawave/api/home?lang=in&page=1";

/* ===============================
   NORMALIZERS
=============================== */

/** Deduplikasi berdasarkan _internalId dalam satu Set. */
function makeDedup() {
  const seen = new Set();
  return (items) =>
    items.filter((i) => {
      if (!i?._internalId || seen.has(i._internalId)) return false;
      seen.add(i._internalId);
      return true;
    });
}

function normalizeTheater(json, unique) {
  if (!Array.isArray(json)) return [];
  return json
    .map((group) => {
      const items = unique(
        (group.contentInfos || []).map((i) => ({
          _internalId: `netshort_${i.shortPlayId}`,
          source: "netshort",
          id: i.shortPlayId,
          title: i.shortPlayName,
          cover: i.shortPlayCover,
          tags: i.labelArray,
          playCount: i.heatScoreShow,
          isNew: i.isNewLabel,
        }))
      );
      return items.length
        ? { id: group.groupId, title: group.contentName, type: "theater", items }
        : null;
    })
    .filter(Boolean);
}

function normalizeDramaBox(json, type, title, unique) {
  if (!Array.isArray(json?.columnVoList)) return [];
  return json.columnVoList
    .map((col) => {
      const items = unique(
        (col.bookList || []).map((b) => ({
          _internalId: `dramabox_${b.bookId}`,
          source: "dramabox",
          id: b.bookId,
          title: b.bookName,
          cover: b.coverWap,
          tags: b.tags,
          episodes: b.chapterCount,
          playCount: b.playCount,
          vip: Boolean(b.corner),
        }))
      );
      return items.length
        ? { id: col.columnId, title: col.title || title, type, items }
        : null;
    })
    .filter(Boolean);
}

function normalizeMelolo(json, id, title, unique) {
  if (!Array.isArray(json?.books)) return [];
  return [
    {
      id,
      title,
      type: "melolo",
      items: unique(
        json.books.map((b) => ({
          _internalId: `melolo_${b.book_id}`,
          source: "melolo",
          id: b.book_id,
          title: b.book_name,
          cover: b.thumb_url,
          description: b.abstract,
          author: b.author,
          episodes: Number(b.serial_count),
          isNew: b.is_new_book === "1",
          isHot: b.is_hot === "1",
          status: b.show_creation_status,
          ageGate: b.age_gate,
        }))
      ),
    },
  ];
}

function normalizeFlickReelsLatest(json, unique) {
  const lists = Array.isArray(json?.data)
    ? json.data.flatMap((d) => (Array.isArray(d?.list) ? d.list : []))
    : [];

  const items = unique(
    lists.map((p) => ({
      _internalId: `flickreels_${p.playlet_id}`,
      source: "flickreels",
      id: Number(p.playlet_id),
      title: p.title,
      cover: p.cover,
      tags: p.playlet_tag_name || [],
      uploadNum: p.upload_num,
      status: p.status,
      hotNum: p.hot_num,
      hotUrl: p.hot_url,
      subscriptUrl: p.subscript_url,
      introduce: p.introduce,
      rankUrl: p.rank_url,
      releaseTime: p.release_time,
    }))
  );

  return items.length
    ? [{ id: "flickreels_latest", title: "🆕 FlickReels Terbaru", type: "flickreels", items }]
    : [];
}

function normalizeFlickReelsHotrank(json, unique) {
  const groups = Array.isArray(json?.data) ? json.data : [];
  return groups
    .map((g) => {
      const items = unique(
        (g.data || []).map((p) => ({
          _internalId: `flickreels_${p.playlet_id}`,
          source: "flickreels",
          id: Number(p.playlet_id),
          title: p.title,
          cover: p.cover,
          coverSquare: p.cover_square,
          tags: p.tag_name || [],
          tagListWithId: p.tag_list_with_id || [],
          hotNum: p.hot_num,
          rankType: p.rank_type,
          rankOrder: p.rank_order,
          rankUrl: p.rank_url,
          hotUrl: p.hot_url,
          introduce: p.introduce,
          uploadNum: p.upload_num,
          status: p.status,
          playletStatus: p.playlet_status,
          genderType: p.gender_type,
          productionType: p.production_type,
          languageId: p.language_id,
          slogan: p.slogan,
          subscript: p.subscript,
          recommendConfigId: p.recommend_config_id,
          chapterSplitVersion: p.chapter_split_version,
          hasCollection: p.has_collection,
        }))
      );
      return items.length
        ? {
            id: `flickreels_hotrank_${g.rank_type}`,
            title: `🔥 ${g.name || "Hot Rank"}`,
            type: "flickreels",
            items,
          }
        : null;
    })
    .filter(Boolean);
}

function normalizeDramawaveHome(json, unique) {
  const groups = Array.isArray(json?.data) ? json.data : [];
  return groups
    .map((g, idx) => {
      const items = unique(
        (Array.isArray(g?.list) ? g.list : []).map((p) => ({
          _internalId: `dramawave_${p.playlet_id}`,
          source: "dramawave",
          id: p.playlet_id,
          title: p.title,
          cover: p.cover,
          uploadNum: p.upload_num,
          episodes: p.chapterCount,
        }))
      );
      return items.length
        ? { id: `dramawave_home_${idx}`, title: g.title || "Dramawave", type: "dramawave", items }
        : null;
    })
    .filter(Boolean);
}

/* ===============================
   MAIN EXPORT
=============================== */

/**
 * Fetch semua data home dari semua provider.
 * @returns {Promise<{ sections: object[] }>}
 */
export async function fetchHomeData() {
  const unique = makeDedup();

  const theaterJson = await safeFetch(THEATER_API, {
    headers: HOME_DEFAULT_HEADERS,
    timeoutMs: 12000,
    retries: 2,
  });

  const dramaboxUrls = Object.values(DRAMABOX_APIS);
  const dramaboxJsons = await mapLimit(dramaboxUrls, 2, (url) =>
    safeFetch(url, { headers: HOME_DEFAULT_HEADERS, timeoutMs: 12000, retries: 2 })
  );

  const meloloUrls = Object.values(MELOLO_APIS);
  const meloloJsons = await mapLimit(meloloUrls, 2, (url) =>
    safeFetch(url, { headers: HOME_MELOLO_HEADERS, timeoutMs: 12000, retries: 2 })
  );

  const [flickreelsLatestJson, flickreelsHotrankJson] = await Promise.all([
    safeFetch(FLICKREELS_APIS.latest, { headers: { accept: "*/*" }, retries: 2 }),
    safeFetch(FLICKREELS_APIS.hotrank, { headers: { accept: "*/*" }, retries: 2 }),
  ]);

  const dramawaveJson = await safeFetch(DRAMAWAVE_API, {
    headers: HOME_DEFAULT_HEADERS,
    timeoutMs: 20000,
    retries: 2,
    retryDelayMs: 800,
  });

  const reelshortJson = await fetchReelshortHome();

  const [freereelsJson, goodshortJson, dramanovaJson, shortmaxJson] = await Promise.all([
    fetchFreeReelsHome(),
    fetchGoodShortHome(),
    fetchDramaNovaHome(),
    fetchShortmaxHome(),
  ]);

  const sections = [
    ...normalizeTheater(theaterJson, unique),

    ...normalizeDramaBox(dramaboxJsons?.[0], "vip", "VIP Eksklusif", unique),
    ...normalizeDramaBox(dramaboxJsons?.[1], "dubindo", "Dub Indo Terpopuler", unique),
    ...normalizeDramaBox(dramaboxJsons?.[2], "random", "Rekomendasi Acak", unique),
    ...normalizeDramaBox(dramaboxJsons?.[3], "latest", "Drama Terbaru", unique),
    ...normalizeDramaBox(dramaboxJsons?.[4], "trending", "🔥 Trending", unique),
    ...normalizeDramaBox(dramaboxJsons?.[5], "populersearch", "🔍 Pencarian Populer", unique),

    ...normalizeMelolo(meloloJsons?.[0], "melolo_latest", "🆕 Melolo Terbaru", unique),
    ...normalizeMelolo(meloloJsons?.[1], "melolo_trending", "🔥 Melolo Trending", unique),

    ...normalizeFlickReelsLatest(flickreelsLatestJson, unique),
    ...normalizeFlickReelsHotrank(flickreelsHotrankJson, unique),

    ...normalizeDramawaveHome(dramawaveJson, unique),

    ...normalizeReelshortHome(reelshortJson, unique),

    ...normalizeFreeReelsHome(freereelsJson, unique),
    ...normalizeGoodShortHome(goodshortJson, unique),
    ...normalizeDramaNovaHome(dramanovaJson, unique),
    ...normalizeShortmaxHome(shortmaxJson, unique),
  ];

  return { sections };
}
