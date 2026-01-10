import { NextResponse } from "next/server";

/* ===============================
   API ENDPOINTS
=============================== */
const DRAMABOX_SEARCH =
  "https://dramabox.sansekai.my.id/api/dramabox/search";
const NETSHORT_SEARCH =
  "https://netshort.sansekai.my.id/api/netshort/search";
const MELOLO_SEARCH =
  "https://melolo-api-azure.vercel.app/api/melolo/search";

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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return NextResponse.json(
        { error: "query (q) wajib diisi" },
        { status: 400 }
      );
    }

    /* ===============================
       FETCH SEMUA SOURCE
    =============================== */
    const [dbJson, nsJson, mlJson] = await Promise.all([
      safeFetch(
        `${DRAMABOX_SEARCH}?query=${encodeURIComponent(q)}`
      ),
      safeFetch(
        `${NETSHORT_SEARCH}?query=${encodeURIComponent(q)}`
      ),
      safeFetch(
        `${MELOLO_SEARCH}?query=${encodeURIComponent(
          q
        )}&limit=10&offset=0`
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
        const id = `dramabox_${item.bookId}`;
        if (!item.bookId || map.has(id)) return;

        map.set(id, {
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
      const id = `netshort_${item.shortPlayId}`;
      if (!item.shortPlayId || map.has(id)) return;

      map.set(id, {
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
       MELOLO (FINAL – SESUAI RESPONSE)
    =============================== */
    const mlGroups = mlJson?.data?.search_data || [];
    mlGroups.forEach((group) => {
      (group.books || []).forEach((book) => {
        const id = `melolo_${book.book_id}`;
        if (!book.book_id || map.has(id)) return;

        map.set(id, {
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
        },
      },
      { status: 500 }
    );
  }
}
