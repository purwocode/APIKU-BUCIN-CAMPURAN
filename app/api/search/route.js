import { NextResponse } from "next/server";

/* ===============================
   API ENDPOINTS
=============================== */
const DRAMABOX_SEARCH = "https://dramabox.sansekai.my.id/api/dramabox/search";
const NETSHORT_SEARCH = "https://netshort.sansekai.my.id/api/netshort/search";
const MELOLO_SEARCH = "https://melolo-api-azure.vercel.app/api/melolo/search";

/** ✅ FlickReels Search */
const FLICKREELS_SEARCH = "https://api.sansekai.my.id/api/flickreels/search";

/** ✅ Dramawave Search (NEW) */
const DRAMAWAVE_SEARCH = "https://dramabos.asia/api/dramawave/api/search";

/* ===============================
   HEADERS
=============================== */
const headers = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

/* ===============================
   SAFE FETCH
=============================== */
async function safeFetch(url) {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("FETCH ERROR:", url, err);
    return null;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return NextResponse.json({ error: "query (q) wajib diisi" }, { status: 400 });
    }

    /* ===============================
       FETCH SEMUA SOURCE
    =============================== */
    const [dbJson, nsJson, mlJson, frJson, dwJson] = await Promise.all([
      safeFetch(`${DRAMABOX_SEARCH}?query=${encodeURIComponent(q)}`),
      safeFetch(`${NETSHORT_SEARCH}?query=${encodeURIComponent(q)}`),
      safeFetch(
        `${MELOLO_SEARCH}?query=${encodeURIComponent(q)}&limit=10&offset=0`
      ),
      safeFetch(`${FLICKREELS_SEARCH}?query=${encodeURIComponent(q)}`),

      /** ✅ Dramawave */
      safeFetch(
        `${DRAMAWAVE_SEARCH}?lang=in&q=${encodeURIComponent(q)}&page=1`
      ),
    ]);

    /* ===============================
       GLOBAL DEDUP
    =============================== */
    const map = new Map();

    /* ===============================
       DRAMABOX
    =============================== */
    if (Array.isArray(dbJson)) {
      dbJson.forEach((item) => {
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

    /* ===============================
       NETSHORT
    =============================== */
    const nsList = nsJson?.searchCodeSearchResult || [];
    nsList.forEach((item) => {
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

    /* ===============================
       MELOLO
    =============================== */
    const mlGroups = mlJson?.data?.search_data || [];
    mlGroups.forEach((group) => {
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

    /* ===============================
       FLICKREELS SEARCH
       response: { status_code, msg, data: [ ... ] }
    =============================== */
    const frList = frJson?.data || [];
    if (Array.isArray(frList)) {
      frList.forEach((item) => {
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
          tagList: item.tag_list || [],
        });
      });
    }

    /* ===============================
       ✅ DRAMAWAVE SEARCH (NEW)
       response: { code, message, data: [ { id, name, desc, series_tag, content_tags, cover, episode_count, ... } ] }
    =============================== */
    const dwList = dwJson?.data || [];
    if (Array.isArray(dwList)) {
      dwList.forEach((item) => {
        const key = `dramawave_${item.id}`;
        if (!item.id || map.has(key)) return;

        const tags = [
          ...(Array.isArray(item.series_tag) ? item.series_tag : []),
          ...(Array.isArray(item.content_tags) ? item.content_tags : []),
        ]
          .filter(Boolean)
          // bersihin highlight {{...}}
          .map((t) => String(t).replace(/{{|}}/g, ""))
          // unique
          .filter((t, idx, arr) => arr.indexOf(t) === idx);

        map.set(key, {
          source: "dramawave",
          id: item.id, // string, contoh: 4YI4vKfC4M
          title: item.name || item.title,
          description: item.desc,
          cover: item.cover,
          episodes: item.episode_count,
          viewCount: item.view_count,
          followCount: item.follow_count,
          commentCount: item.comment_count,
          vip: Boolean(item.free === false), // optional (free=false berarti berbayar)
          tags,

          // optional: preview episode 1 kalau kamu butuh
          previewEpisode: item.episode
            ? {
                id: item.episode.id,
                name: item.episode.name,
                cover: item.episode.cover,
                m3u8:
                  item.episode.external_audio_h264_m3u8 ||
                  item.episode.m3u8_url ||
                  "",
                subtitles: Array.isArray(item.episode.subtitle_list)
                  ? item.episode.subtitle_list.map((s) => ({
                      lang: s.language,
                      name: s.display_name,
                      url: s.subtitle,
                      type: s.type,
                      format: "srt",
                    }))
                  : [],
              }
            : null,
        });
      });
    }

    /* ===============================
       RESULT
    =============================== */
    const results = Array.from(map.values());

    return NextResponse.json({
      query: q,
      total: results.length,
      results,
      sourceFailed: {
        dramabox: dbJson === null,
        netshort: nsJson === null,
        melolo: mlJson === null,
        flickreels: frJson === null,
        dramawave: dwJson === null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err?.message || "Unknown error",
        results: [],
        sourceFailed: {
          dramabox: true,
          netshort: true,
          melolo: true,
          flickreels: true,
          dramawave: true,
        },
      },
      { status: 500 }
    );
  }
}
