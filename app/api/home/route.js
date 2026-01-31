import { NextResponse } from "next/server";

/* ===============================
   API ENDPOINTS
=============================== */
const THEATER_API = "https://netshort.sansekai.my.id/api/netshort/theaters";

const DRAMABOX_APIS = {
  vip: "https://dramabox.sansekai.my.id/api/dramabox/vip",
  dubindo:
    "https://dramabox.sansekai.my.id/api/dramabox/dubindo?classify=terpopuler",
  random: "https://dramabox.sansekai.my.id/api/dramabox/randomdrama",
  latest: "https://dramabox.sansekai.my.id/api/dramabox/latest",
  trending: "https://dramabox.sansekai.my.id/api/dramabox/trending",
  populersearch: "https://dramabox.sansekai.my.id/api/dramabox/populersearch",
};

const MELOLO_APIS = {
  latest: "https://melolo-api-azure.vercel.app/api/melolo/latest",
  trending: "https://melolo-api-azure.vercel.app/api/melolo/trending",
};

/** ✅ FLICKREELS */
const FLICKREELS_APIS = {
  latest: "https://api.sansekai.my.id/api/flickreels/latest",
  hotrank: "https://api.sansekai.my.id/api/flickreels/hotrank",
};

/** ✅ DRAMAWAVE */
const DRAMAWAVE_API =
  "https://dramabos.asia/api/dramawave/api/home?lang=in&page=1";

/* ===============================
   HEADERS
=============================== */
const DEFAULT_HEADERS = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

const MELOLO_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
};

/* ===============================
   HELPERS
=============================== */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mapLimit(arr, limit, mapper) {
  const ret = new Array(arr.length);
  let i = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= arr.length) break;
      ret[idx] = await mapper(arr[idx], idx);
    }
  });

  await Promise.all(workers);
  return ret;
}

/* ===============================
   SAFE FETCH (timeout + retry + safe json)
=============================== */
async function safeFetch(
  url,
  headers,
  { timeoutMs = 12000, retries = 2, retryDelayMs = 600 } = {}
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) return null;

      // Parse aman (hindari "Unexpected end of JSON input")
      const ct = res.headers.get("content-type") || "";
      const raw = await res.text();
      if (!raw) return null;

      const looksJson =
        ct.includes("application/json") ||
        raw.trim().startsWith("{") ||
        raw.trim().startsWith("[");

      if (!looksJson) return null;

      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error("JSON PARSE ERROR:", url, e);
        return null;
      }
    } catch (err) {
      console.error("FETCH ERROR:", url, err);

      const msg = String(err?.message || err);
      const isRetryable =
        msg.includes("ECONNRESET") ||
        msg.includes("UND_ERR_CONNECT_TIMEOUT") ||
        msg.includes("fetch failed") ||
        msg.includes("AbortError") ||
        msg.includes("aborted");

      if (!isRetryable || attempt === retries) return null;

      // backoff kecil
      await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(t);
    }
  }

  return null;
}

export async function GET() {
  try {
    /* ===============================
       1️⃣ FETCH SEMUA API (batasi concurrency)
    =============================== */
    const theaterJson = await safeFetch(THEATER_API, DEFAULT_HEADERS, {
      timeoutMs: 12000,
      retries: 2,
    });

    const dramaboxUrls = Object.values(DRAMABOX_APIS);
    const dramaboxJsons = await mapLimit(dramaboxUrls, 2, (url) =>
      safeFetch(url, DEFAULT_HEADERS, { timeoutMs: 12000, retries: 2 })
    );

    const meloloUrls = Object.values(MELOLO_APIS);
    const meloloJsons = await mapLimit(meloloUrls, 2, (url) =>
      safeFetch(url, MELOLO_HEADERS, { timeoutMs: 12000, retries: 2 })
    );

    /** ✅ FlickReels fetch */
    const [flickreelsLatestJson, flickreelsHotrankJson] = await Promise.all([
      safeFetch(FLICKREELS_APIS.latest, { accept: "*/*" }, { retries: 2 }),
      safeFetch(FLICKREELS_APIS.hotrank, { accept: "*/*" }, { retries: 2 }),
    ]);

    /** ✅ Dramawave fetch (timeout lebih lama karena sering lambat) */
    const dramawaveJson = await safeFetch(DRAMAWAVE_API, DEFAULT_HEADERS, {
      timeoutMs: 20000,
      retries: 2,
      retryDelayMs: 800,
    });

    /* ===============================
       2️⃣ GLOBAL DEDUP (PAKAI INTERNAL ID)
    =============================== */
    const seen = new Set();
    const unique = (items) =>
      items.filter((i) => {
        if (!i?._internalId) return false;
        if (seen.has(i._internalId)) return false;
        seen.add(i._internalId);
        return true;
      });

    /* ===============================
       3️⃣ THEATER NORMALIZER
    =============================== */
    const theaterSections = Array.isArray(theaterJson)
      ? theaterJson
          .map((group) => {
            const items = unique(
              (group.contentInfos || []).map((i) => ({
                _internalId: `netshort_${i.shortPlayId}`,
                id: i.shortPlayId,
                title: i.shortPlayName,
                cover: i.shortPlayCover,
                tags: i.labelArray,
                playCount: i.heatScoreShow,
                isNew: i.isNewLabel,
              }))
            );

            return items.length
              ? {
                  id: group.groupId,
                  title: group.contentName,
                  type: "theater",
                  items,
                }
              : null;
          })
          .filter(Boolean)
      : [];

    /* ===============================
       4️⃣ DRAMABOX NORMALIZER
    =============================== */
    const normalizeDramaBox = (json, type, title) =>
      Array.isArray(json?.columnVoList)
        ? json.columnVoList
            .map((col) => {
              const items = unique(
                (col.bookList || []).map((b) => ({
                  _internalId: `dramabox_${b.bookId}`,
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
                ? {
                    id: col.columnId,
                    title: col.title || title,
                    type,
                    items,
                  }
                : null;
            })
            .filter(Boolean)
        : [];

    /* ===============================
       5️⃣ MELOLO NORMALIZER
    =============================== */
    const normalizeMelolo = (json, id, title) =>
      Array.isArray(json?.books)
        ? [
            {
              id,
              title,
              type: "melolo",
              items: unique(
                json.books.map((b) => ({
                  _internalId: `melolo_${b.book_id}`,
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
          ]
        : [];

    const meloloLatest = normalizeMelolo(
      meloloJsons?.[0],
      "melolo_latest",
      "🆕 Melolo Terbaru"
    );

    const meloloTrending = normalizeMelolo(
      meloloJsons?.[1],
      "melolo_trending",
      "🔥 Melolo Trending"
    );

    /* ===============================
       ✅ 6️⃣ FLICKREELS NORMALIZERS
    =============================== */

    // FlickReels Latest: { data: [{ list: [...] }, ...] }
    const normalizeFlickReelsLatest = (json) => {
      const lists = Array.isArray(json?.data)
        ? json.data.flatMap((d) => (Array.isArray(d?.list) ? d.list : []))
        : [];

      const items = unique(
        lists.map((p) => ({
          _internalId: `flickreels_${p.playlet_id}`,
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
        ? [
            {
              id: "flickreels_latest",
              title: "🆕 FlickReels Terbaru",
              type: "flickreels",
              items,
            },
          ]
        : [];
    };

    // FlickReels Hot Rank: { data: [{ name, rank_type, data: [...] }, ...] }
    const normalizeFlickReelsHotrank = (json) => {
      const groups = Array.isArray(json?.data) ? json.data : [];

      return groups
        .map((g) => {
          const items = unique(
            (g.data || []).map((p) => ({
              _internalId: `flickreels_${p.playlet_id}`,
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
    };

    const flickreelsLatest = normalizeFlickReelsLatest(flickreelsLatestJson);
    const flickreelsHotrank = normalizeFlickReelsHotrank(flickreelsHotrankJson);

    /* ===============================
       ✅ 6.5️⃣ DRAMAWAVE NORMALIZER
       Dramawave: { code, message, data: [{ title, list: [...] }, ...] }
    =============================== */
    const normalizeDramawaveHome = (json) => {
      const groups = Array.isArray(json?.data) ? json.data : [];

      return groups
        .map((g, idx) => {
          const items = unique(
            (Array.isArray(g?.list) ? g.list : []).map((p) => ({
              _internalId: `dramawave_${p.playlet_id}`,
              id: p.playlet_id, // string
              title: p.title,
              cover: p.cover,
              uploadNum: p.upload_num,
              episodes: p.chapterCount,
            }))
          );

          return items.length
            ? {
                id: `dramawave_home_${idx}`,
                title: g.title || "Dramawave",
                type: "dramawave",
                items,
              }
            : null;
        })
        .filter(Boolean);
    };

    const dramawaveSections = normalizeDramawaveHome(dramawaveJson);

    /* ===============================
       7️⃣ GABUNG SEMUA SECTION
    =============================== */
    const sections = [
      ...theaterSections,

      ...normalizeDramaBox(dramaboxJsons?.[0], "vip", "VIP Eksklusif"),
      ...normalizeDramaBox(dramaboxJsons?.[1], "dubindo", "Dub Indo Terpopuler"),
      ...normalizeDramaBox(dramaboxJsons?.[2], "random", "Rekomendasi Acak"),
      ...normalizeDramaBox(dramaboxJsons?.[3], "latest", "Drama Terbaru"),
      ...normalizeDramaBox(dramaboxJsons?.[4], "trending", "🔥 Trending"),
      ...normalizeDramaBox(
        dramaboxJsons?.[5],
        "populersearch",
        "🔍 Pencarian Populer"
      ),

      ...meloloLatest,
      ...meloloTrending,

      /** ✅ FlickReels */
      ...flickreelsLatest,
      ...flickreelsHotrank,

      /** ✅ Dramawave */
      ...dramawaveSections,
    ];

    return NextResponse.json({ sections });
  } catch (err) {
    return NextResponse.json(
      { sections: [], error: err?.message || "ERROR" },
      { status: 500 }
    );
  }
}
