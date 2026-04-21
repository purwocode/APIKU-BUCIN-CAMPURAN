import { safeFetch } from "../safeFetch.js";
import { SANSEKAI_HEADERS } from "../headers.js";

const BASE = "https://api.sansekai.my.id/api/freereels";

const FETCH_OPTS = { headers: SANSEKAI_HEADERS, timeoutMs: 15000, retries: 2 };

/**
 * FreeReels mengekspos detail + seluruh episode dari endpoint detailAndAllEpisode.
 * @param {string} id — FreeReels drama key (e.g. "Sur05EE19R")
 * @returns {Promise<object|null>}
 */
export async function fetchFreeReelsEpisodes(id) {
  try {
    const json = await safeFetch(
      `${BASE}/detailAndAllEpisode?key=${encodeURIComponent(id)}`,
      FETCH_OPTS
    );

    const info = json?.data?.info;

    if (!info?.id || !Array.isArray(info?.episode_list) || info.episode_list.length === 0) {
      return null;
    }

    const episodes = info.episode_list
      .filter((ep) => ep?.external_audio_h264_m3u8 || ep?.m3u8_url)
      .map((ep, idx) => {
        const videos = [];
        if (ep.external_audio_h264_m3u8) {
          videos.push({ quality: "H264", url: ep.external_audio_h264_m3u8, vip: false });
        }
        if (ep.external_audio_h265_m3u8) {
          videos.push({ quality: "H265", url: ep.external_audio_h265_m3u8, vip: false });
        }
        if (ep.m3u8_url) {
          videos.push({ quality: "default", url: ep.m3u8_url, vip: false });
        }
        const subtitles = Array.isArray(ep.subtitle_list)
          ? ep.subtitle_list.map((s) => ({
              language: s.language,
              name: s.display_name,
              url: s.subtitle,
              vtt: s.vtt || null,
              format: s.vtt ? "vtt" : "srt",
            }))
          : [];
        return {
          id: ep.id || String(idx + 1),
          episode: ep.index || idx + 1,
          title: ep.name || `EP ${idx + 1}`,
          thumbnail: ep.cover || null,
          vip: ep.unlock === false,
          subtitle: subtitles,
          videos,
        };
      });

    if (episodes.length === 0) return null;

    return {
      source: "freereels",
      id,
      title: info.name || null,
      cover: info.cover || null,
      description: info.desc || null,
      totalEpisode: info.episode_count ?? episodes.length,
      episodes,
    };
  } catch (err) {
    console.error("[freereels] ERROR:", err);
    return null;
  }
}
