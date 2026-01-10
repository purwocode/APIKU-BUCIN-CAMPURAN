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
  latest:
    "https://melolo-api-azure.vercel.app/api/melolo/latest",
  trending:
    "https://melolo-api-azure.vercel.app/api/melolo/trending",
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
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });
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
    const theaterJson = await safeFetch(
      THEATER_API,
      DEFAULT_HEADERS
    );

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

    /* ===============================
       2️⃣ GLOBAL DEDUP
    =============================== */
    const seen = new Set();
    const unique = (items) =>
      items.filter((i) => {
        if (!i?.id) return false;
        if (seen.has(i.id)) return false;
        seen.add(i.id);
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
                id: `netshort_${i.shortPlayId}`,
                title: i.shortPlayName,
                cover: i.shortPlayCover,
                tags: i.labelArray,
                playCount: i.heatScoreShow,
                isNew: i.isNewLabel,
              }))
            );
            return items.length
              ? {
                  id: `theater_${group.groupId}`,
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
                  id: `dramabox_${b.bookId}`,
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
                    id: `${type}_${col.columnId}`,
                    title: col.title || title,
                    type,
                    items,
                  }
                : null;
            })
            .filter(Boolean)
        : [];

    /* ===============================
       5️⃣ MELOLO NORMALIZER (FINAL)
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
                  id: `melolo_${b.book_id}`,
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
       6️⃣ GABUNG SEMUA SECTION
    =============================== */
    const sections = [
      ...theaterSections,
      ...normalizeDramaBox(
        dramaboxJsons[0],
        "vip",
        "VIP Eksklusif"
      ),
      ...normalizeDramaBox(
        dramaboxJsons[1],
        "dubindo",
        "Dub Indo Terpopuler"
      ),
      ...normalizeDramaBox(
        dramaboxJsons[2],
        "random",
        "Rekomendasi Acak"
      ),
      ...normalizeDramaBox(
        dramaboxJsons[3],
        "latest",
        "Drama Terbaru"
      ),
      ...normalizeDramaBox(
        dramaboxJsons[4],
        "trending",
        "🔥 Trending"
      ),
      ...normalizeDramaBox(
        dramaboxJsons[5],
        "populersearch",
        "🔍 Pencarian Populer"
      ),
      ...meloloLatest,
      ...meloloTrending,
    ];

    return NextResponse.json({ sections });
  } catch (err) {
    return NextResponse.json(
      { sections: [], error: err?.message || "ERROR" },
      { status: 500 }
    );
  }
}
