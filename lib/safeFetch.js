import { EPISODE_HEADERS } from "./headers.js";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Throttled Promise.all — jalankan mapper max `limit` concurrent.
 */
export async function mapLimit(arr, limit, mapper) {
  const ret = new Array(arr.length);
  let i = 0;

  const workers = Array.from({ length: Math.min(limit, arr.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= arr.length) break;
      ret[idx] = await mapper(arr[idx], idx);
    }
  });

  await Promise.all(workers);
  return ret;
}

/**
 * Fetch dengan timeout, retry otomatis, dan safe JSON parsing.
 * @param {string} url
 * @param {{ timeoutMs?: number, retries?: number, retryDelayMs?: number, headers?: object }} options
 * @returns {Promise<object|null>}
 */
export async function safeFetch(
  url,
  { timeoutMs = 15000, retries = 2, retryDelayMs = 600, headers = EPISODE_HEADERS } = {}
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) return null;

      const ct = res.headers.get("content-type") || "";
      const raw = await res.text();
      if (!raw) return null;

      const looksJson =
        ct.includes("application/json") ||
        raw.trim().startsWith("{") ||
        raw.trim().startsWith("[");

      if (!looksJson) return null;

      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error("[safeFetch] JSON parse error:", url, e);
        return null;
      }
    } catch (err) {
      console.error("[safeFetch] fetch error:", url, err);

      const msg = String(err?.message || err);
      const isRetryable =
        msg.includes("ECONNRESET") ||
        msg.includes("UND_ERR_CONNECT_TIMEOUT") ||
        msg.includes("fetch failed") ||
        msg.includes("AbortError") ||
        msg.includes("aborted");

      if (!isRetryable || attempt === retries) return null;
      await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}
