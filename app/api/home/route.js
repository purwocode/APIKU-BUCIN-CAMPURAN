import { NextResponse } from "next/server";
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";

export const runtime = "nodejs";

/* ===============================
   API ENDPOINTS
=============================== */
const THEATER_API =
  "https://netshort.sansekai.my.id/api/netshort/theaters";

const DRAMABOX_APIS = {
  vip: "https://dramabox.sansekai.my.id/api/dramabox/vip",
  dubindo:
    "https://dramabox.sansekai.my.id/api/dramabox/dubindo?classify=terpopuler",
  random: "https://dramabox.sansekai.my.id/api/dramabox/randomdrama",
  latest: "https://dramabox.sansekai.my.id/api/dramabox/latest",
  trending: "https://dramabox.sansekai.my.id/api/dramabox/trending",
  populersearch:
    "https://dramabox.sansekai.my.id/api/dramabox/populersearch",
};

const MELOLO_APIS = {
  latest: "https://melolo-api-azure.vercel.app/api/melolo/latest",
  trending: "https://melolo-api-azure.vercel.app/api/melolo/trending",
};

// FlickReels
const FLICK_LATEST =
  "https://api.sansekai.my.id/api/flickreels/latest";
const FLICK_FORYOU =
  "https://api.sansekai.my.id/api/flickreels/foryou";

/* ===============================
   RTDB (REST, PUBLIC)
   /proxies/proxies/{id}
=============================== */
const RTDB_BASE_URL =
  "https://proxy-cf6c5-default-rtdb.asia-southeast1.firebasedatabase.app";
const RTDB_PROXY_PATH = "proxies/proxies";

/* ===============================
   HEADERS
=============================== */
const DEFAULT_HEADERS = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

const FLICK_HEADERS = {
  ...DEFAULT_HEADERS,
  referer: "https://api.sansekai.my.id/",
  connection: "keep-alive",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

/* ===============================
   UTIL
=============================== */
const fixImage = (url) => {
  if (!url) return null;
  return url.replace(/\.heic(\?.*)?$/i, ".jpg$1");
};

async function safeFetch(url, headers = DEFAULT_HEADERS) {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ===============================
   RTDB SOCKS5 PROXY
=============================== */
let proxyCache = { list: [], ts: 0 };
const CACHE_MS = 30_000;

function rtdbUrl(path) {
  return `${RTDB_BASE_URL}/${path}.json`;
}

function pickProxy(list) {
  if (!list?.length) return null;
  const slice = list.slice(0, 20);
  return slice[Math.floor(Math.random() * slice.length)];
}

async function getAliveProxy() {
  const now = Date.now();
  if (proxyCache.list.length && now - proxyCache.ts < CACHE_MS) {
    return pickProxy(proxyCache.list);
  }

  const res = await fetch(rtdbUrl(RTDB_PROXY_PATH), {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (!data) return null;

  const list = Object.values(data)
    .filter(
      (p) =>
        p?.alive === true &&
        typeof p.proxy === "string" &&
        p.proxy.includes(":")
    )
    .sort((a, b) => (b.lastChecked || 0) - (a.lastChecked || 0))
    .map((p) => p.proxy.trim());

  proxyCache = { list, ts: now };
  return pickProxy(list);
}

/* ===============================
   FlickReels via SOCKS5
=============================== */
async function fetchFlickViaSocks(url) {
  const proxy = await getAliveProxy();
  const proxyUrl = proxy ? `socks5://${proxy}` : null;

  try {
    if (proxyUrl) {
      const agent = new SocksProxyAgent(proxyUrl);
      const { data } = await axios.get(url, {
        headers: FLICK_HEADERS,
        httpAgent: agent,
        httpsAgent: agent,
        timeout: 15000,
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return data ?? null;
    }
  } catch {}

  return await safeFetch(url, FLICK_HEADERS);
}

/* ===============================
   HANDLER
=============================== */
export async function GET() {
  try {
    const [
      theaterJson,
      dramaboxJsons,
      meloloJsons,
      flickLatestJson,
      flickForYouJson,
    ] = await Promise.all([
      safeFetch(THEATER_API),
      Promise.all(Object.values(DRAMABOX_APIS).map(safeFetch)),
      Promise.all(Object.values(MELOLO_APIS).map(safeFetch)),
      fetchFlickViaSocks(FLICK_LATEST),
      fetchFlickViaSocks(FLICK_FORYOU),
    ]);

    const seen = new Set();
    const unique = (arr) =>
      arr.filter((i) => i?.id && !seen.has(i.id) && seen.add(i.id));

    /* ===============================
       THEATER
    =============================== */
    const theaterSections = Array.isArray(theaterJson)
      ? theaterJson
          .map((g) => {
            const items = unique(
              (g.contentInfos || []).map((i) => ({
                id: String(i.shortPlayId),
                title: i.shortPlayName,
                cover: fixImage(i.shortPlayCover),
                tags: i.labelArray,
                playCount: i.heatScoreShow,
                isNew: i.isNewLabel,
                source: "netshort",
              }))
            );
            return items.length
              ? {
                  id: String(g.groupId),
                  title: g.contentName,
                  type: "theater",
                  items,
                }
              : null;
          })
          .filter(Boolean)
      : [];

    /* ===============================
       DRAMABOX
    =============================== */
    const normalizeDramaBox = (json, type, title) =>
      Array.isArray(json?.columnVoList)
        ? json.columnVoList
            .map((c) => {
              const items = unique(
                (c.bookList || []).map((b) => ({
                  id: String(b.bookId),
                  title: b.bookName,
                  cover: fixImage(b.coverWap),
                  tags: b.tags,
                  episodes: b.chapterCount,
                  playCount: b.playCount,
                  vip: Boolean(b.corner),
                  source: "dramabox",
                }))
              );
              return items.length
                ? {
                    id: String(c.columnId),
                    title: c.title || title,
                    type,
                    items,
                  }
                : null;
            })
            .filter(Boolean)
        : [];

    /* ===============================
       MELOLO
    =============================== */
    const normalizeMelolo = (json, title) =>
      Array.isArray(json?.books)
        ? [
            {
              id: title.toLowerCase().replace(/\s+/g, "_"),
              title,
              type: "melolo",
              items: unique(
                json.books.map((b) => ({
                  id: String(b.book_id),
                  title: b.book_name,
                  cover: fixImage(b.thumb_url),
                  description: b.abstract,
                  author: b.author,
                  episodes: Number(b.serial_count),
                  isNew: b.is_new_book === "1",
                  isHot: b.is_hot === "1",
                  status: b.show_creation_status,
                  ageGate: b.age_gate,
                  source: "melolo",
                }))
              ),
            },
          ]
        : [];

    /* ===============================
       FLICKREELS SECTIONS
    =============================== */
    const normalizeFlick = (json, id, title) =>
      Array.isArray(json?.data)
        ? [
            {
              id,
              title,
              type: "flickreels",
              items: unique(
                json.data.flatMap((b) =>
                  (b.list || []).map((f) => ({
                    id: String(f.playlet_id),
                    title: f.title,
                    cover: fixImage(f.cover),
                    episodes: Number(f.upload_num) || 0,
                    tags: f.playlet_tag_name || [],
                    status: f.status,
                    source: "flickreels",
                  }))
                )
              ),
            },
          ]
        : [];

    const sections = [
      ...theaterSections,
      ...normalizeDramaBox(dramaboxJsons[0], "vip", "VIP Eksklusif"),
      ...normalizeDramaBox(dramaboxJsons[1], "dubindo", "Dub Indo Terpopuler"),
      ...normalizeDramaBox(dramaboxJsons[2], "random", "Rekomendasi Acak"),
      ...normalizeDramaBox(dramaboxJsons[3], "latest", "Drama Terbaru"),
      ...normalizeDramaBox(dramaboxJsons[4], "trending", "🔥 Trending"),
      ...normalizeDramaBox(
        dramaboxJsons[5],
        "populersearch",
        "🔍 Pencarian Populer"
      ),
      ...normalizeMelolo(meloloJsons[0], "🆕 Melolo Terbaru"),
      ...normalizeMelolo(meloloJsons[1], "🔥 Melolo Trending"),
      ...normalizeFlick(flickLatestJson, "flick_latest", "🎬 FlickReels Terbaru"),
      ...normalizeFlick(flickForYouJson, "flick_foryou", "✨ FlickReels For You"),
    ];

    return NextResponse.json({ sections });
  } catch (err) {
    return NextResponse.json(
      { sections: [], error: err?.message || "ERROR" },
      { status: 500 }
    );
  }
}
