import { safeFetch } from "../safeFetch.js";
import { SANSEKAI_HEADERS } from "../headers.js";

const BASE = "https://api.sansekai.my.id/api/dramanova";
const DRAMANOVA_HOME = `${BASE}/home`;

const FETCH_OPTS = { headers: SANSEKAI_HEADERS, timeoutMs: 12000, retries: 2 };

/* ===============================
   HOME
=============================== */

export async function fetchDramaNovaHome() {
  return safeFetch(DRAMANOVA_HOME, FETCH_OPTS);
}

/**
 * Normalize DramaNova home response.
 * Response: { rows: [{dramaId, title, posterImg, totalEpisodes, synopsis, categoryNames}] }
 */
export function normalizeDramaNovaHome(json, unique) {
  const rows = Array.isArray(json?.rows) ? json.rows : [];
  const items = unique(
    rows
      .filter((i) => i?.dramaId && i?.title)
      .map((i) => ({
        _internalId: `dramanova_${i.dramaId}`,
        source: "dramanova",
        id: i.dramaId,
        title: i.title,
        cover: i.posterImg || null,
        description: i.synopsis || i.description || null,
        episodes: i.totalEpisodes || null,
        tags: typeof i.categoryNames === "string"
          ? i.categoryNames.split(" ").filter(Boolean)
          : [],
        isCompleted: i.isCompleted === "1",
      }))
  );

  return items.length
    ? [{ id: "dramanova_home", title: "DramaNova", type: "dramanova", items }]
    : [];
}
