import { safeFetch } from "../safeFetch.js";
import { DRAMABOX_HEADERS } from "../headers.js";

const DRAMABOX_EP = "https://api.sansekai.my.id/api/dramabox/allepisode";

/**
 * Fetch semua episode dari DramaBox (fallback terakhir).
 * @param {string} id  — bookId
 * @returns {Promise<object|null>}  null jika tidak match / error
 */
export async function fetchDramaboxEpisodes(id) {
  try {
    const json = await safeFetch(`${DRAMABOX_EP}?bookId=${id}`, {
      headers: DRAMABOX_HEADERS,
      timeoutMs: 15000,
    });

    if (!Array.isArray(json) || json.length === 0) return null;

    const episodes = json.map((ep) => {
      const cdn = ep.cdnList?.find((c) => c.isDefault === 1) || ep.cdnList?.[0];

      const videos =
        cdn?.videoPathList?.map((v) => ({
          quality: v.quality,
          url: v.videoPath,
          vip: v.isVipEquity === 1,
        })) || [];

      return {
        id: ep.chapterId,
        episode: (ep.chapterIndex ?? 0) + 1,
        title: ep.chapterName,
        thumbnail: ep.chapterImg,
        vip: ep.isCharge === 1,
        subtitle: [],  // spriteSnapshotUrl adalah sprite sheet, bukan subtitle
        videos,
      };
    });

    return {
      source: "dramabox",
      id,
      totalEpisode: episodes.length,
      episodes,
    };
  } catch (err) {
    console.error("[dramabox] ERROR:", err);
    return null;
  }
}
