import { safeFetch, mapLimit } from "../safeFetch.js";

const MELOLO_EP = "https://melolo-api-azure.vercel.app/api/melolo/detail";
const MELOLO_STREAM = "https://melolo-api-azure.vercel.app/api/melolo/stream";

/** Resolve URL stream untuk satu video via Melolo stream API. */
async function resolveMeloloMainUrl(vid) {
  const json = await safeFetch(`${MELOLO_STREAM}/${vid}`, { timeoutMs: 10000, retries: 1 });
  return json?.data?.main_url || null;
}

/**
 * Fetch semua episode dari Melolo.
 * @param {string} id  — series ID
 * @returns {Promise<object|null>}  null jika tidak match / error
 */
export async function fetchMeloloEpisodes(id) {
  try {
    const json = await safeFetch(`${MELOLO_EP}/${id}`, { timeoutMs: 15000 });
    const videoData = json?.data?.video_data;
    const list = videoData?.video_list;

    if (!Array.isArray(list) || list.length === 0) return null;

    // Throttle: max 5 stream URL resolution sekaligus
    const episodes = await mapLimit(list, 5, async (ep) => {
      const mainUrl = await resolveMeloloMainUrl(ep.vid);
      const isVip = ep.disable_play === true;
      return {
        id: ep.vid,
        episode: ep.vid_index,
        title: `EP ${ep.vid_index}`,
        thumbnail: ep.episode_cover || ep.cover,
        vip: isVip,
        subtitle: [],
        videos: mainUrl
          ? [{ quality: "auto", url: mainUrl, vip: isVip }]
          : [],
      };
    });

    return {
      source: "melolo",
      id,
      title: videoData.series_title,
      cover: videoData.series_cover,
      totalEpisode: videoData.episode_cnt,
      episodes,
    };
  } catch (err) {
    console.error("[melolo] ERROR:", err);
    return null;
  }
}
