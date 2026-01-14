import { NextResponse } from "next/server";

/* ===============================
   API ENDPOINTS
=============================== */
const THEATER_API =
  "https://netshort.sansekai.my.id/api/netshort/theaters";

const DRAMABOX_APIS = {
  vip: "https://dramabox.sansekai.my.id/api/dramabox/vip",
  dubindo:
    "https://dramabox.sansekai.my.id/api/dramabox/dubindo?classify=terpopuler",
  random: "https://dramabox.sansekai.my.id/api/dramabox/randomdrama",
  latest: "https://dramabox.sansekai.my.id/api/dramabox/latest",
  trending: "https://dramabox.sansekai.my.id/api/dramabox/trending",
  populersearch:
    "https://dramabox.sansekai.my.id/api/dramabox/populersearch",
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
   SAFE FETCH
=============================== */
async function safeFetch(url, headers) {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("FETCH ERROR:", url, err);
    return null;
  }
}

export async function GET() {
  try {
    /* ===============================
       1️⃣ FETCH SEMUA API
    =============================== */
    const theaterJson = await safeFetch(THEATER_API, DEFAULT_HEADERS);

    const dramaboxJsons = await Promise.all(
      Object.values(DRAMABOX_APIS).map((url) =>
        safeFetch(url, DEFAULT_HEADERS)
      )
    );

    const meloloJsons = await Promise.all(
      Object.values(MELOLO_APIS).map((url) =>
        safeFetch(url, MELOLO_HEADERS)
      )
    );

    /** ✅ FlickReels fetch (latest + hotrank) */
    const [flickreelsLatestJson, flickreelsHotrankJson] = await Promise.all([
      safeFetch(FLICKREELS_APIS.latest, { accept: "*/*" }),
      safeFetch(FLICKREELS_APIS.hotrank, { accept: "*/*" }),
    ]);

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
      meloloJsons[0],
      "melolo_latest",
      "🆕 Melolo Terbaru"
    );

    const meloloTrending = normalizeMelolo(
      meloloJsons[1],
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
       7️⃣ GABUNG SEMUA SECTION
    =============================== */
    const sections = [
      ...theaterSections,
      ...normalizeDramaBox(dramaboxJsons[0], "vip", "VIP Eksklusif"),
      ...normalizeDramaBox(dramaboxJsons[1], "dubindo", "Dub Indo Terpopuler"),
      ...normalizeDramaBox(dramaboxJsons[2], "random", "Rekomendasi Acak"),
      ...normalizeDramaBox(dramaboxJsons[3], "latest", "Drama Terbaru"),
      ...normalizeDramaBox(dramaboxJsons[4], "trending", "🔥 Trending"),
      ...normalizeDramaBox(dramaboxJsons[5], "populersearch", "🔍 Pencarian Populer"),
      ...meloloLatest,
      ...meloloTrending,

      /** ✅ FlickReels */
      ...flickreelsLatest,
      ...flickreelsHotrank,
    ];

    return NextResponse.json({ sections });
  } catch (err) {
    return NextResponse.json(
      { sections: [], error: err?.message || "ERROR" },
      { status: 500 }
    );
  }
}
