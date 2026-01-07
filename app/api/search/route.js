import { NextResponse } from "next/server";

const DRAMABOX_SEARCH =
  "https://dramabox.sansekai.my.id/api/dramabox/search";
const NETSHORT_SEARCH =
  "https://netshort.sansekai.my.id/api/netshort/search";

const headers = {
  accept: "*/*",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36",
};

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

    const [dbRes, nsRes] = await Promise.all([
      fetch(`${DRAMABOX_SEARCH}?query=${encodeURIComponent(q)}`, {
        headers,
        cache: "no-store",
      }),
      fetch(`${NETSHORT_SEARCH}?query=${encodeURIComponent(q)}`, {
        headers,
        cache: "no-store",
      }),
    ]);

    const dbJson = await dbRes.json();
    const nsJson = await nsRes.json();

    const map = new Map();

    /* ===============================
       DRAMABOX
    =============================== */
    if (Array.isArray(dbJson)) {
      dbJson.forEach((item) => {
        const id = item.bookId;
        if (!id || map.has(id)) return;

        map.set(id, {
          source: "dramabox",
          id,
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
      const id = item.shortPlayId;
      if (!id || map.has(id)) return;

      map.set(id, {
        source: "netshort",
        id,
        title: item.shortPlayName?.replace(/<[^>]+>/g, ""),
        description: item.shotIntroduce,
        cover: item.shortPlayCover,
        tags: item.labelNameList || [],
        heat: item.formatHeatScore,
      });
    });

    const results = Array.from(map.values());

    return NextResponse.json({
      query: q,
      total: results.length,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
