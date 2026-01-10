import { NextResponse } from "next/server";

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

async function safeFetch(url, headers) {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Fetch error for ${url}:`, err);
    return null;
  }
}

export async function GET() {
  const headers = {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    referer: "https://netshort.sansekai.my.id/",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  };

  try {
    const theaterJson = await safeFetch(THEATER_API, headers);
    const dramaboxJsons = await Promise.all(
      Object.values(DRAMABOX_APIS).map((url) => safeFetch(url, headers))
    );

    // Dedup
    const seenIds = new Set();
    const uniqueItems = (items) =>
      items.filter((item) => {
        if (!item?.id) return false;
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

    // THEATER
    const theaterSections = Array.isArray(theaterJson)
      ? theaterJson
          .map((group) => {
            const items = uniqueItems(
              (group.contentInfos || []).map((item) => ({
                id: item.shortPlayId,
                title: item.shortPlayName,
                cover: item.shortPlayCover,
                tags: item.labelArray,
                playCount: item.heatScoreShow,
                isNew: item.isNewLabel,
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

    const normalizeDramaBox = (json, type, fallbackTitle) =>
      Array.isArray(json?.columnVoList)
        ? json.columnVoList
            .map((col) => {
              const items = uniqueItems(
                (col.bookList || []).map((book) => ({
                  id: book.bookId,
                  title: book.bookName,
                  cover: book.coverWap,
                  tags: book.tags,
                  playCount: book.playCount,
                  episodes: book.chapterCount,
                  vip: Boolean(book.corner),
                }))
              );
              return items.length
                ? {
                    id: `${type}_${col.columnId}`,
                    title: col.title || fallbackTitle,
                    type,
                    items,
                  }
                : null;
            })
            .filter(Boolean)
        : [];

    const [
      vipJson,
      dubJson,
      randomJson,
      latestJson,
      trendingJson,
      populerSearchJson,
    ] = dramaboxJsons;

    const sections = [
      ...theaterSections,
      ...normalizeDramaBox(vipJson, "vip", "VIP Eksklusif"),
      ...normalizeDramaBox(dubJson, "dubindo", "Dub Indo Terpopuler"),
      ...normalizeDramaBox(randomJson, "random", "Rekomendasi Acak"),
      ...normalizeDramaBox(latestJson, "latest", "Drama Terbaru"),
      ...normalizeDramaBox(trendingJson, "trending", "🔥 Trending"),
      ...normalizeDramaBox(populerSearchJson, "populersearch", "🔍 Pencarian Populer"),
    ];

    return NextResponse.json({ sections });
  } catch (err) {
    return NextResponse.json({ sections: [], error: err?.message || "Unknown error" });
  }
}
