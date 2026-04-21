/** Blok IP spoofing yang digunakan di semua provider. */
export const IP_SPOOF_HEADERS = {
  'X-Forwarded-For': '127.0.0.1',
  'X-Originating-IP': '127.0.0.1',
  'X-Remote-IP': '127.0.0.1',
  'X-Remote-Addr': '127.0.0.1',
  'X-Client-IP': '127.0.0.1',
  'X-Host': '127.0.0.1',
  'X-Forwarded-Host': '127.0.0.1',
  'X-Real-IP': '127.0.0.1',
  'Forwarded': 'for=127.0.0.1;by=127.0.0.1;host=127.0.0.1',
  'X-Original-URL': '/',
  'X-Rewrite-URL': '/',
  'X-Custom-IP-Authorization': '127.0.0.1',
  'X-ProxyUser-IP': '127.0.0.1',
  'True-Client-IP': '127.0.0.1',
  'Referer': 'https://www.google.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * Shared request headers untuk semua provider episode.
 * Digunakan bersama dengan safeFetch.
 */
export const EPISODE_HEADERS = { ...IP_SPOOF_HEADERS };

/** Headers umum untuk home & dramawave (browser-like, tidak perlu IP spoofing). */
export const HOME_DEFAULT_HEADERS = {
  accept: "*/*",
  ...IP_SPOOF_HEADERS,
};

/** Headers khusus Melolo (butuh accept HTML). */
export const HOME_MELOLO_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
};

/** Headers untuk search (browser-like). */
export const SEARCH_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  ...IP_SPOOF_HEADERS,
};

/** Headers khusus NetShort episode (browser-like + sec-fetch). */
export const NETSHORT_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  ...IP_SPOOF_HEADERS,
};

/** Headers untuk DramaBox episode — IP spoofing + browser headers. */
export const DRAMABOX_HEADERS = {
  ...EPISODE_HEADERS,
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  priority: "u=1, i",
  Referer: "https://api.sansekai.my.id/",
};

/** Headers untuk ReelShort — identik dengan DramaBox (sama-sama api.sansekai.my.id). */
export const REELSHORT_HEADERS = {
  ...EPISODE_HEADERS,
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  priority: "u=1, i",
  Referer: "https://api.sansekai.my.id/",
};

/** Headers khusus ReelShort homepage — gunakan referer google seperti probe yang valid. */
export const REELSHORT_HOME_HEADERS = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  priority: "u=1, i",
  ...IP_SPOOF_HEADERS,
};

/** Headers untuk provider api.sansekai.my.id (FreeReels, GoodShort, DramaNova). */
export const SANSEKAI_HEADERS = {
  ...EPISODE_HEADERS,
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  Referer: "https://api.sansekai.my.id/",
};

/** Headers untuk watch DramaWave. */
export const WATCH_HEADERS = {
  accept: "application/json",
  ...IP_SPOOF_HEADERS,
};
