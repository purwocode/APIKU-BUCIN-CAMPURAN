import { NextResponse } from "next/server";

const DRAMAWAVE_WATCH_BASE = "https://dramabos.asia/api/dramawave/api/watch";

const headers = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

async function safeFetch(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const ep = searchParams.get("ep");

  if (!id || !ep) {
    return NextResponse.json(
      { error: "id dan ep wajib diisi" },
      { status: 400 }
    );
  }

  const url = `${DRAMAWAVE_WATCH_BASE}/${encodeURIComponent(
    id
  )}/${encodeURIComponent(ep)}?lang=in`;

  const json = await safeFetch(url, 20000);

  if (!json) {
    return NextResponse.json(
      { error: "gagal ambil watch" },
      { status: 502 }
    );
  }

  return NextResponse.json(json);
}
