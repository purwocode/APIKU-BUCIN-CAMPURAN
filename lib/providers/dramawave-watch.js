import { safeFetch } from "../safeFetch.js";
import { WATCH_HEADERS } from "../headers.js";

const DRAMAWAVE_WATCH_BASE = "https://dramabos.asia/api/dramawave/api/watch";

/**
 * Fetch data watch (stream) dari DramaWave.
 * @param {string} id   — playlet/drama ID
 * @param {string} ep   — episode number/ID
 * @returns {Promise<object|null>}  null jika gagal
 */
export async function fetchDramawaveWatch(id, ep) {
  const url = `${DRAMAWAVE_WATCH_BASE}/${encodeURIComponent(id)}/${encodeURIComponent(ep)}?lang=in`;
  return await safeFetch(url, { headers: WATCH_HEADERS, timeoutMs: 20000, retries: 1 });
}
