import { safeFetch, mapLimit } from "../safeFetch.js";
import { SANSEKAI_HEADERS } from "../headers.js";

const BASE = "https://api.sansekai.my.id/api/goodshort";
const GOODSHORT_ALLEPISODE = `${BASE}/allepisode`;
const GOODSHORT_DECRYPT = `${BASE}/decrypt`;

const FETCH_OPTS = { headers: SANSEKAI_HEADERS, timeoutMs: 15000, retries: 2 };
const DECRYPT_OPTS = { headers: SANSEKAI_HEADERS, timeoutMs: 10000, retries: 1 };

async function resolveGoodShortVideo(video) {
  if (!video?.filePath) return null;

  const json = await safeFetch(
    `${GOODSHORT_DECRYPT}?url=${encodeURIComponent(video.filePath)}`,
    DECRYPT_OPTS
  );

  const streamUrl = json?.streamUrl;
  if (!streamUrl) return null;

  return {
    quality: video.type || "default",
    url: streamUrl,
    originalUrl: video.filePath,
    size: video.fileSize || null,
    vip: false,
  };
}

/**
 * Fetch semua episode dari GoodShort.
 * Response: { data: { bookId, bookName, bookCover, introduction, downloadList: [{id, index, chapterName, image, bookId, price, multiVideos}] } }
 * Video m3u8 di-resolve lewat /api/goodshort/decrypt?url=<rawM3u8>
 * Endpoint allepisode yang diprobe saat ini tidak mengekspos field subtitle.
 * @param {string} id — bookId
 * @returns {Promise<object|null>}
 */
export async function fetchGoodShortEpisodes(id) {
  try {
    const json = await safeFetch(
      `${GOODSHORT_ALLEPISODE}?bookId=${id}`,
      FETCH_OPTS
    );

    if (!json?.data?.bookId || !Array.isArray(json?.data?.downloadList)) {
      return null;
    }

    const { bookName, bookCover, introduction, downloadList } = json.data;

    const episodes = await mapLimit(downloadList, 3, async (ep) => {
      const resolvedVideos = await Promise.all(
        (Array.isArray(ep.multiVideos) ? ep.multiVideos : []).map(resolveGoodShortVideo)
      );

      return {
        id: String(ep.id),
        episode: ep.index + 1,
        title: ep.chapterName || `EP ${ep.index + 1}`,
        thumbnail: ep.image || null,
        vip: ep.price > 0,
        subtitle: [],
        videos: resolvedVideos.filter(Boolean),
      };
    });

    const playable = episodes.filter((ep) => ep.videos.length > 0);
    if (playable.length === 0) return null;

    return {
      source: "goodshort",
      id,
      title: bookName || null,
      cover: bookCover || null,
      description: introduction || null,
      totalEpisode: episodes.length,
      episodes,
    };
  } catch (err) {
    console.error("[goodshort] ERROR:", err);
    return null;
  }
}
