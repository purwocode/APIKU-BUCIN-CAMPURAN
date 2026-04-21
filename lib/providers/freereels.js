import { safeFetch } from "../safeFetch.js";
import { SANSEKAI_HEADERS } from "../headers.js";

const BASE = "https://api.sansekai.my.id/api/freereels";
const FREEREELS_HOMEPAGE = `${BASE}/homepage`;

const FETCH_OPTS = { headers: SANSEKAI_HEADERS, timeoutMs: 12000, retries: 2 };

/* ===============================
   HOME
=============================== */

export async function fetchFreeReelsHome() {
  return safeFetch(FREEREELS_HOMEPAGE, FETCH_OPTS);
}

/**
 * Normalize FreeReels homepage response.
 * Response: { data: { items: [ { type, module_name, show_title, items: [{key,title,cover,...}] } ] } }
 */
export function normalizeFreeReelsHome(json, unique) {
  const sections = Array.isArray(json?.data?.items) ? json.data.items : [];
  return sections
    .map((section) => {
      const items = unique(
        (Array.isArray(section.items) ? section.items : [])
          .filter((i) => i?.key && i?.title)
          .map((i) => ({
            _internalId: `freereels_${i.key}`,
            source: "freereels",
            id: i.key,
            title: i.title,
            cover: i.cover || null,
            description: i.desc || null,
            episodes: i.episode_count || null,
            tags: Array.isArray(i.content_tags) ? i.content_tags : [],
          }))
      );
      return items.length
        ? {
            id: `freereels_${section.module_key || section.type}`,
            title: section.module_name || "FreeReels",
            type: "freereels",
            items,
          }
        : null;
    })
    .filter(Boolean);
}
