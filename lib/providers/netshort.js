import { safeFetch } from "../safeFetch.js";
import { NETSHORT_HEADERS } from "../headers.js";

const NETSHORT_EP = "https://netshort.sansekai.my.id/api/netshort/allepisode";

/**
 * Fetch semua episode dari NetShort.
 * @param {string} id  — shortPlayId
 * @returns {Promise<object|null>}  null jika tidak match / error
 */
export async function fetchNetshortEpisodes(id) {
  try {
    const json = await safeFetch(`${NETSHORT_EP}?shortPlayId=${id}`, {
      headers: NETSHORT_HEADERS,
      timeoutMs: 15000,
    });

    if (!json?.shortPlayEpisodeInfos?.length) return null;

    const episodes = json.shortPlayEpisodeInfos.map((ep) => {
      const isVip = Boolean(ep.isVip || ep.isLock);
      return {
        id: ep.episodeId,
        episode: ep.episodeNo,
        title: `EP ${ep.episodeNo}`,
        thumbnail: ep.episodeCover,
        vip: isVip,
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
            vip: isVip,
          },
        ],
      };
    });

    return {
      source: "netshort",
      id,
      title: json.shortPlayName,
      cover: json.shortPlayCover,
      totalEpisode: json.totalEpisode,
      episodes,
    };
  } catch (err) {
    console.error("[netshort] ERROR:", err);
    return null;
  }
}
