import { safeFetch } from "../safeFetch.js";

const FLICKREELS_DETAIL =
  "https://api.sansekai.my.id/api/flickreels/detailAndAllEpisode";

/**
 * Fetch semua episode dari FlickReels.
 * Hanya return jika ada minimal 1 episode playable (punya video URL).
 * @param {string} id
 * @returns {Promise<object|null>}  null jika tidak match / error
 */
export async function fetchFlickreelsEpisodes(id) {
  try {
    const json = await safeFetch(
      `${FLICKREELS_DETAIL}?id=${encodeURIComponent(id)}`,
      { timeoutMs: 15000 }
    );

    if (!json?.drama || !Array.isArray(json?.episodes) || json.episodes.length === 0) {
      return null;
    }

    const drama = json.drama;

    const episodes = json.episodes
      .map((ep) => {
        const raw = ep?.raw || {};
        const isLocked = raw?.is_lock === 1;
        const videoUrl = raw?.videoUrl || ep?.videoUrl || null;

        return {
          id: ep.id || raw.chapter_id,
          episode:
            typeof raw.chapter_num === "number"
              ? raw.chapter_num
              : (ep.index ?? 0) + 1,
          title:
            ep.name || raw.chapter_title || `EP ${(ep.index ?? 0) + 1}`,
          thumbnail: raw.chapter_cover || drama.cover,
          vip: isLocked,
          subtitle: [],
          videos: videoUrl
            ? [{ quality: "auto", url: videoUrl, vip: isLocked }]
            : [],
        };
      })
      .filter((e) => e.videos.length > 0);

    if (episodes.length === 0) return null;

    return {
      source: "flickreels",
      id,
      title: drama.title,
      cover: drama.cover,
      description: drama.description,
      totalEpisode: drama.chapterCount || episodes.length,
      episodes,
    };
  } catch (err) {
    console.error("[flickreels] ERROR:", err);
    return null;
  }
}
