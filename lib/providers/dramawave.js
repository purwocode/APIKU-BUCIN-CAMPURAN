import { safeFetch } from "../safeFetch.js";

const DRAMAWAVE_DETAIL_BASE = "https://dramabos.asia/api/dramawave/api/drama";

/**
 * Fetch semua episode dari DramaWave (detail only, no watch mass).
 * Hanya return jika ada minimal 1 episode playable (punya hls_url).
 * @param {string} id
 * @returns {Promise<object|null>}  null jika tidak match / error
 */
export async function fetchDramawaveEpisodes(id) {
  try {
    const detail = await safeFetch(
      `${DRAMAWAVE_DETAIL_BASE}/${encodeURIComponent(id)}?lang=in`,
      { timeoutMs: 20000, retries: 2, retryDelayMs: 800 }
    );

    if (!detail?.playlet_id || !Array.isArray(detail?.list) || detail.list.length === 0) {
      return null;
    }

    const episodes = detail.list
      .map((ep) => {
        const subtitles = Array.isArray(ep?.subtitle_list)
          ? ep.subtitle_list.map((s) => ({
              lang: s.language,
              name: s.display_name,
              url: s.subtitle,
              type: s.type,
              format: "srt",
            }))
          : [];

        return {
          id: ep?.chapter_id || `${detail.playlet_id}_${ep?.chapter_num}`,
          episode: ep?.chapter_num,
          title: ep?.chapter_name || `EP ${ep?.chapter_num}`,
          thumbnail: ep?.chapter_cover || detail.cover,
          vip: Boolean(ep?.is_vip),
          subtitle: subtitles,
          videos: ep?.hls_url
            ? [{ quality: "auto", url: ep.hls_url, vip: Boolean(ep?.is_vip) }]
            : [],
        };
      })
      .filter((e) => e.videos.length > 0);

    if (episodes.length === 0) return null;

    return {
      source: "dramawave",
      id: detail.playlet_id,
      title: detail.title,
      cover: detail.cover,
      description: detail.description,
      tags: detail.tags || [],
      viewCount: detail.view_count,
      followCount: detail.follow_count,
      totalEpisode: episodes.length,
      episodes,
    };
  } catch (err) {
    console.error("[dramawave] ERROR:", err);
    return null;
  }
}
