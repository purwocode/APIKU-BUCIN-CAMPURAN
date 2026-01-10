import { NextResponse } from "next/server";

const DRAMABOX_EP =
  "https://dramabox.sansekai.my.id/api/dramabox/allepisode";
const NETSHORT_EP =
  "https://netshort.sansekai.my.id/api/netshort/allepisode";

const headers = {
  accept: "*/*",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36",
};

// safe fetch → return null kalau error
async function safeFetch(url) {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Fetch error for ${url}:`, err);
    return null;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id wajib diisi" },
        { status: 400 }
      );
    }

    // coba Netshort dulu
    const nsJson = await safeFetch(`${NETSHORT_EP}?shortPlayId=${id}`);

    if (nsJson?.shortPlayEpisodeInfos) {
      const episodes = nsJson.shortPlayEpisodeInfos.map((ep) => ({
        id: ep.episodeId,
        episode: ep.episodeNo,
        title: `EP ${ep.episodeNo}`,
        thumbnail: ep.episodeCover,
        vip: ep.isVip || ep.isLock,
        subtitle:
          ep.subtitleList?.map((s) => ({
            lang: s.subtitleLanguage,
            url: s.url,
            format: s.format,
          })) || [],
        videos: [
          {
            quality: ep.playClarity,
            url: ep.playVoucher,
            vip: ep.isVip,
          },
        ],
      }));

      return NextResponse.json({
        source: "netshort",
        id,
        title: nsJson.shortPlayName,
        cover: nsJson.shortPlayCover,
        totalEpisode: nsJson.totalEpisode,
        episodes,
        sourceFailed: { netshort: false, dramabox: false },
      });
    }

    // fallback ke Dramabox
    const dbJson = await safeFetch(`${DRAMABOX_EP}?bookId=${id}`);

    if (!Array.isArray(dbJson)) {
      return NextResponse.json({
        error: "ID tidak valid untuk Netshort maupun Dramabox",
        sourceFailed: { netshort: nsJson === null, dramabox: dbJson === null },
      }, { status: 404 });
    }

    const episodes = dbJson.map((ep) => {
      const cdn =
        ep.cdnList?.find((c) => c.isDefault === 1) ||
        ep.cdnList?.[0];

      const videos =
        cdn?.videoPathList?.map((v) => ({
          quality: v.quality,
          url: v.videoPath,
          vip: v.isVipEquity === 1,
        })) || [];

      return {
        id: ep.chapterId,
        episode: ep.chapterIndex + 1,
        title: ep.chapterName,
        thumbnail: ep.chapterImg,
        vip: ep.isCharge === 1,
        subtitle: ep.spriteSnapshotUrl
          ? [
              {
                lang: "auto",
                url: ep.spriteSnapshotUrl,
                format: "webvtt",
              },
            ]
          : [],
        videos,
      };
    });

    return NextResponse.json({
      source: "dramabox",
      id,
      totalEpisode: episodes.length,
      episodes,
      sourceFailed: { netshort: nsJson === null, dramabox: false },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err?.message || "Unknown error",
        sourceFailed: { netshort: true, dramabox: true },
      },
      { status: 500 }
    );
  }
}
