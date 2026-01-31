import { NextResponse } from "next/server";

const MELOLO_EP = "https://melolo-api-azure.vercel.app/api/melolo/detail";
const MELOLO_STREAM = "https://melolo-api-azure.vercel.app/api/melolo/stream";

const NETSHORT_EP = "https://netshort.sansekai.my.id/api/netshort/allepisode";
const DRAMABOX_EP = "https://dramabox.sansekai.my.id/api/dramabox/allepisode";

/** ✅ FlickReels Detail + All Episode */
const FLICKREELS_DETAIL =
  "https://api.sansekai.my.id/api/flickreels/detailAndAllEpisode";

/** ✅ Dramawave Detail + Watch */
const DRAMAWAVE_DETAIL_BASE = "https://dramabos.asia/api/dramawave/api/drama";
const DRAMAWAVE_WATCH_BASE = "https://dramabos.asia/api/dramawave/api/watch";

/* ===============================
   HEADERS
=============================== */
const headers = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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

/** safe fetch: timeout + retry + safe json */
async function safeFetch(
  url,
  { timeoutMs = 15000, retries = 2, retryDelayMs = 600 } = {}
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
      await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

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
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
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

      if (frJson?.drama && Array.isArray(frJson?.episodes)) {
        const drama = frJson.drama;

        const episodes = frJson.episodes.map((ep) => {
          const raw = ep?.raw || {};
          const isLocked = raw?.is_lock === 1;

          return {
            id: ep.id || raw.chapter_id,
            episode:
              typeof raw.chapter_num === "number" ? raw.chapter_num : ep.index + 1,
            title: ep.name || raw.chapter_title || `EP ${ep.index + 1}`,
            thumbnail: raw.chapter_cover || drama.cover,
            vip: isLocked,
            subtitle: [],
            videos: raw.videoUrl
              ? [
                  {
                    quality: "auto",
                    url: raw.videoUrl,
                    vip: isLocked,
                  },
                ]
              : [],
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
       ✅ 4️⃣ DRAMAWAVE (DETAIL + WATCH)
       Detail:  /drama/{id}?lang=in  -> { title, description, tags, cover, list: [...] }
       Watch:   /watch/{id}/{ep}?lang=in -> { video, subtitle, is_vip }
    =============================== */
    try {
      const detailUrl = `${DRAMAWAVE_DETAIL_BASE}/${encodeURIComponent(
        id
      )}?lang=in`;

      const dwDetail = await safeFetch(detailUrl, {
        timeoutMs: 20000,
        retries: 2,
        retryDelayMs: 800,
      });

      if (dwDetail?.playlet_id && Array.isArray(dwDetail?.list)) {
        // Batasi jumlah episode yang di-fetch watch (kalau mau full, biarkan saja)
        const rawEpisodes = dwDetail.list;

        const episodes = await mapLimit(rawEpisodes, 3, async (ep) => {
          const epNum = ep?.chapter_num;
          const watchUrl = `${DRAMAWAVE_WATCH_BASE}/${encodeURIComponent(
            id
          )}/${encodeURIComponent(epNum)}?lang=in`;

          const watch = await safeFetch(watchUrl, {
            timeoutMs: 20000,
            retries: 2,
            retryDelayMs: 800,
          });

          // subtitle pilihan:
          // - ambil dari watch.subtitle (biasanya 1)
          // - plus list subtitle dari detail (bisa banyak bahasa)
          const subtitleFromWatch = watch?.subtitle
            ? [
                {
                  lang: "auto",
                  url: watch.subtitle,
                  format: "srt",
                },
              ]
            : [];

          const subtitleFromDetail = Array.isArray(ep?.subtitle_list)
            ? ep.subtitle_list.map((s) => ({
                lang: s.language,
                name: s.display_name,
                url: s.subtitle,
                type: s.type,
                format: "srt",
              }))
            : [];

          const isVip = Boolean(watch?.is_vip ?? ep?.is_vip);

          return {
            id: ep?.chapter_id || watch?.chapter_id || `${id}_${epNum}`,
            episode: epNum,
            title: ep?.chapter_name || `EP ${epNum}`,
            thumbnail: ep?.chapter_cover || dwDetail.cover,
            vip: isVip,

            // gabung subtitle (watch + list lengkap)
            subtitle: [...subtitleFromWatch, ...subtitleFromDetail],

            // video pakai watch.video (lebih “resmi”)
            videos: watch?.video
              ? [
                  {
                    quality: "auto",
                    url: watch.video,
                    vip: isVip,
                  },
                ]
              : ep?.hls_url
              ? [
                  {
                    quality: "auto",
                    url: ep.hls_url,
                    vip: isVip,
                  },
                ]
              : [],
          };
        });

        return NextResponse.json({
          source: "dramawave",
          id: dwDetail.playlet_id,
          title: dwDetail.title,
          cover: dwDetail.cover,
          description: dwDetail.description,
          tags: dwDetail.tags || [],
          viewCount: dwDetail.view_count,
          followCount: dwDetail.follow_count,
          totalEpisode: rawEpisodes.length,
          episodes,
        });
      }
    } catch (err) {
      console.error("DRAMAWAVE ERROR:", err);
    }

    /* ===============================
       5️⃣ DRAMABOX
    =============================== */
    const dbRes = await fetch(`${DRAMABOX_EP}?bookId=${id}`, {
      headers,
      cache: "no-store",
    });

    const dbJson = await dbRes.json();

    if (!Array.isArray(dbJson)) {
      throw new Error(
        "ID tidak valid untuk Melolo, NetShort, FlickReels, DramaWave, maupun DramaBox"
      );
    }

    const episodes = dbJson.map((ep) => {
      const cdn = ep.cdnList?.find((c) => c.isDefault === 1) || ep.cdnList?.[0];

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
