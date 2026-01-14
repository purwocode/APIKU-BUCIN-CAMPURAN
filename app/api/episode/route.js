import { NextResponse } from "next/server";

const MELOLO_EP =
  "https://melolo-api-azure.vercel.app/api/melolo/detail";
const MELOLO_STREAM =
  "https://melolo-api-azure.vercel.app/api/melolo/stream";

const NETSHORT_EP =
  "https://netshort.sansekai.my.id/api/netshort/allepisode";
const DRAMABOX_EP =
  "https://dramabox.sansekai.my.id/api/dramabox/allepisode";

/** ✅ NEW: FlickReels Detail + All Episode */
const FLICKREELS_DETAIL =
  "https://api.sansekai.my.id/api/flickreels/detailAndAllEpisode";

/* ===============================
   HEADERS
=============================== */
const headers = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

async function resolveMeloloMainUrl(vid) {
  try {
    const res = await fetch(`${MELOLO_STREAM}/${vid}`, {
      headers,
      cache: "no-store",
    });
    const json = await res.json();
    return json?.data?.main_url || null;
  } catch {
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

    /* ===============================
       1️⃣ MELOLO
    =============================== */
    try {
      const meloloRes = await fetch(`${MELOLO_EP}/${id}`, {
        headers,
        cache: "no-store",
      });

      const meloloJson = await meloloRes.json();
      const videoData = meloloJson?.data?.video_data;
      const list = videoData?.video_list;

      if (Array.isArray(list) && list.length > 0) {
        const episodes = await Promise.all(
          list.map(async (ep) => {
            const mainUrl = await resolveMeloloMainUrl(ep.vid);

            return {
              id: ep.vid,
              episode: ep.vid_index,
              title: `EP ${ep.vid_index}`,
              thumbnail: ep.episode_cover || ep.cover,
              vip: ep.disable_play === true,
              subtitle: [],
              videos: mainUrl
                ? [
                    {
                      quality: "auto",
                      url: mainUrl,
                      vip: ep.disable_play === true,
                    },
                  ]
                : [],
            };
          })
        );

        return NextResponse.json({
          source: "melolo",
          id,
          title: videoData.series_title,
          cover: videoData.series_cover,
          totalEpisode: videoData.episode_cnt,
          episodes,
        });
      }
    } catch (err) {
      console.error("MELOLO ERROR:", err);
    }

    /* ===============================
       2️⃣ NETSHORT
    =============================== */
    try {
      const nsRes = await fetch(`${NETSHORT_EP}?shortPlayId=${id}`, {
        headers,
        cache: "no-store",
      });

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
    } catch {}

    /* ===============================
       ✅ 3️⃣ FLICKREELS (DETAIL + ALL EPISODE)
    =============================== */
    try {
      const frRes = await fetch(
        `${FLICKREELS_DETAIL}?id=${encodeURIComponent(id)}`,
        { headers, cache: "no-store" }
      );

      const frJson = await frRes.json();

      // Bentuk response: { drama: {...}, episodes: [...] }
      if (frJson?.drama && Array.isArray(frJson?.episodes)) {
        const drama = frJson.drama;

        const episodes = frJson.episodes.map((ep) => {
          const raw = ep?.raw || {};
          const isLocked = raw?.is_lock === 1;

          return {
            id: ep.id || raw.chapter_id,
            episode:
              typeof raw.chapter_num === "number"
                ? raw.chapter_num
                : ep.index + 1,
            title: ep.name || raw.chapter_title || `EP ${ep.index + 1}`,
            thumbnail: raw.chapter_cover || drama.cover,
            vip: isLocked,
            subtitle: [],
            videos: raw.videoUrl
              ? [
                  {
                    quality: "auto",
                    url: raw.videoUrl, // ✅ MP4 langsung
                    vip: isLocked,
                  },
                ]
              : [],
            // opsional: kalau kamu mau simpan raw juga
            // raw,
          };
        });

        return NextResponse.json({
          source: "flickreels",
          id,
          title: drama.title,
          cover: drama.cover,
          description: drama.description,
          totalEpisode: drama.chapterCount || episodes.length,
          episodes,
        });
      }
    } catch (err) {
      console.error("FLICKREELS ERROR:", err);
    }

    /* ===============================
       4️⃣ DRAMABOX
    =============================== */
    const dbRes = await fetch(`${DRAMABOX_EP}?bookId=${id}`, {
      headers,
      cache: "no-store",
    });

    const dbJson = await dbRes.json();

    if (!Array.isArray(dbJson)) {
      throw new Error(
        "ID tidak valid untuk Melolo, NetShort, FlickReels, maupun DramaBox"
      );
    }

    const episodes = dbJson.map((ep) => {
      const cdn =
        ep.cdnList?.find((c) => c.isDefault === 1) || ep.cdnList?.[0];

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
