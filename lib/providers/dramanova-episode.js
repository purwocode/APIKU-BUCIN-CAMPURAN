import { safeFetch, mapLimit } from "../safeFetch.js";
import { SANSEKAI_HEADERS } from "../headers.js";

const BASE = "https://api.sansekai.my.id/api/dramanova";
const DRAMANOVA_DETAIL = `${BASE}/detail`;
const DRAMANOVA_GETVIDEO = `${BASE}/getvideo`;

const DETAIL_OPTS = { headers: SANSEKAI_HEADERS, timeoutMs: 15000, retries: 2 };
const VIDEO_OPTS = { headers: SANSEKAI_HEADERS, timeoutMs: 10000, retries: 1 };

/**
 * Resolve video URLs untuk satu episode menggunakan fileId.
 * Response: { Result: { PlayInfoList: [{Definition, MainPlayUrl, Codec, Bitrate}] } }
 */
async function resolveVideoUrls(fileId) {
  const json = await safeFetch(
    `${DRAMANOVA_GETVIDEO}?fileId=${encodeURIComponent(fileId)}`,
    VIDEO_OPTS
  );
  if (!Array.isArray(json?.Result?.PlayInfoList)) return [];
  return json.Result.PlayInfoList
    .filter((v) => v?.MainPlayUrl)
    .map((v) => ({
      quality: v.Definition || "default",
      codec: v.Codec || null,
      url: v.MainPlayUrl,
      backupUrl: v.BackupPlayUrl || null,
      bitrate: v.Bitrate || null,
      vip: false,
    }));
}

/**
 * Fetch semua episode dari DramaNova.
 * 1. GET /api/dramanova/detail?dramaId=<id> → daftar episode dengan fileId
 * 2. Untuk setiap episode, GET /api/dramanova/getvideo?fileId=<fileId>
 * @param {string} id — dramaId
 * @returns {Promise<object|null>}
 */
export async function fetchDramaNovaEpisodes(id) {
  try {
    const detail = await safeFetch(
      `${DRAMANOVA_DETAIL}?dramaId=${encodeURIComponent(id)}`,
      DETAIL_OPTS
    );

    if (!detail?.data?.dramaId || !Array.isArray(detail?.data?.episodes) || detail.data.episodes.length === 0) {
      return null;
    }

    const episodes = await mapLimit(detail.data.episodes, 5, async (ep) => {
      const videos = ep.fileId ? await resolveVideoUrls(ep.fileId) : [];

      const subtitle = Array.isArray(ep.subtitleTracks)
        ? ep.subtitleTracks
            .filter((s) => s?.label)
            .map((s) => ({ language: s.language || "id", url: s.label }))
        : [];

      return {
        id: ep.id || ep.fileId,
        episode: ep.episodeNumber,
        title: ep.episodeTitle?.replace(/\.mp4$/i, "").replace(/_/g, " ") || `EP ${ep.episodeNumber}`,
        thumbnail: ep.thumbnailImg
          ? `https://cover.hikeuniverses.xyz/${ep.thumbnailImg}`
          : null,
        vip: false,
        subtitle,
        videos,
      };
    });

    const playable = episodes.filter((ep) => ep.videos.length > 0);
    if (playable.length === 0) return null;

    return {
      source: "dramanova",
      id,
      title: detail.data.title || null,
      cover: detail.data.posterImg || null,
      description: detail.data.synopsis || null,
      totalEpisode: detail.data.totalEpisodes ?? episodes.length,
      episodes,
    };
  } catch (err) {
    console.error("[dramanova] ERROR:", err);
    return null;
  }
}
