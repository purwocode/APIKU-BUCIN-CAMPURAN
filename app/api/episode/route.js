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

    /* ===============================
       1️⃣ COBA NETSHORT DULU
    =============================== */
    try {
      const nsRes = await fetch(
        `${NETSHORT_EP}?shortPlayId=${id}`,
        { headers, cache: "no-store" }
      );

      const nsJson = await nsRes.json();

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
        });
      }
    } catch (_) {}

    /* ===============================
       2️⃣ FALLBACK → DRAMABOX
    =============================== */
    const dbRes = await fetch(
      `${DRAMABOX_EP}?bookId=${id}`,
      { headers, cache: "no-store" }
    );

    const dbJson = await dbRes.json();

    if (!Array.isArray(dbJson)) {
      throw new Error("ID tidak valid untuk NetShort maupun DramaBox");
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
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
