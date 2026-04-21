import { safeFetch, mapLimit } from "../safeFetch.js";
import { REELSHORT_HOME_HEADERS } from "../headers.js";

const BASE = "https://api.sansekai.my.id/api/shortmax";
const SHORTMAX_LATEST = `${BASE}/latest`;
const SHORTMAX_SEARCH = `${BASE}/search`;
const SHORTMAX_DETAIL = `${BASE}/detail`;
const SHORTMAX_EPISODE = `${BASE}/episode`;

const FETCH_OPTS = { headers: REELSHORT_HOME_HEADERS, timeoutMs: 15000, retries: 2 };
const EPISODE_OPTS = { headers: REELSHORT_HOME_HEADERS, timeoutMs: 10000, retries: 1 };

export async function fetchShortmaxHome() {
  try {
    return await safeFetch(SHORTMAX_LATEST, FETCH_OPTS);
  } catch (err) {
    console.error("[shortmax-home] ERROR:", err);
    return null;
  }
}

export function normalizeShortmaxHome(json, unique) {
  if (!Array.isArray(json?.results)) return [];

  const items = unique(
    json.results.map((i) => ({
      _internalId: `shortmax_${i.shortPlayId}`,
      source: "shortmax",
      id: i.shortPlayId,
      title: i.name,
      cover: i.cover,
      episodes: i.totalEpisodes,
      tags: [i.label, i.tag].filter(Boolean),
      collectNum: i.collectNum,
    }))
  );

  return items.length
    ? [{ id: "shortmax_latest", title: "⚡ ShortMax Terbaru", type: "shortmax", items }]
    : [];
}

export async function fetchShortmaxSearch(q) {
  try {
    return await safeFetch(`${SHORTMAX_SEARCH}?query=${encodeURIComponent(q)}`, FETCH_OPTS);
  } catch (err) {
    console.error("[shortmax-search] ERROR:", err);
    return null;
  }
}

export function normalizeShortmaxSearch(json, map) {
  if (!Array.isArray(json?.results)) return;

  json.results.forEach((item) => {
    const key = `shortmax_${item.shortPlayId}`;
    if (!item.shortPlayId || map.has(key)) return;

    map.set(key, {
      source: "shortmax",
      id: item.shortPlayId,
      title: item.name,
      cover: item.cover,
      tags: Array.isArray(item.genre) ? item.genre : [],
    });
  });
}

function normalizeEpisodeVideos(ep) {
  if (!ep?.videoUrl || typeof ep.videoUrl !== "object") return [];

  return Object.entries(ep.videoUrl)
    .filter(([, url]) => Boolean(url))
    .map(([key, url]) => ({
      quality: key.replace(/^video_/, "") || "default",
      url,
      bitrate: ep.bitRate?.[key] || null,
      codec: ep.codec?.[key] || null,
      vip: ep.locked === true,
    }));
}

export async function fetchShortmaxEpisodes(id) {
  try {
    const detail = await safeFetch(
      `${SHORTMAX_DETAIL}?shortPlayId=${encodeURIComponent(id)}`,
      FETCH_OPTS
    );

    if (!detail?.data?.id) return null;

    const totalEpisode = Number(detail.data.totalEpisodes || detail.data.updateEpisode || 0);
    if (!totalEpisode) return null;

    const numbers = Array.from({ length: totalEpisode }, (_, idx) => idx + 1);

    const episodes = await mapLimit(numbers, 5, async (episodeNumber) => {
      const json = await safeFetch(
        `${SHORTMAX_EPISODE}?shortPlayId=${encodeURIComponent(id)}&episodeNumber=${episodeNumber}`,
        EPISODE_OPTS
      );

      const ep = json?.episode;
      if (!ep?.id) return null;

      return {
        id: String(ep.id),
        episode: ep.episodeNum || episodeNumber,
        title: `EP ${ep.episodeNum || episodeNumber}`,
        thumbnail: ep.cover || detail.data.picUrl || null,
        vip: ep.locked === true,
        subtitle: [],
        videos: normalizeEpisodeVideos(ep),
      };
    });

    const compactEpisodes = episodes.filter(Boolean);
    if (compactEpisodes.length === 0) return null;

    return {
      source: "shortmax",
      id,
      title: detail.data.shortPlayName || null,
      cover: detail.data.picUrl || null,
      description: detail.data.summary || detail.data.recommendContent || null,
      totalEpisode,
      episodes: compactEpisodes,
    };
  } catch (err) {
    console.error("[shortmax-episode] ERROR:", err);
    return null;
  }
}
