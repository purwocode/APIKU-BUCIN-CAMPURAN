import { NextResponse } from "next/server";
import { fetchDramawaveWatch } from "../../../lib/providers/dramawave-watch.js";

/**
 * GET /api/watch?id=<id>&ep=<ep>
 *
 * Fetch stream/watch data dari DramaWave untuk satu episode.
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const ep = searchParams.get("ep");

  if (!id || !ep) {
    return NextResponse.json({ error: "id dan ep wajib diisi" }, { status: 400 });
  }

  const json = await fetchDramawaveWatch(id, ep);

  if (!json) {
    return NextResponse.json({ error: "gagal ambil watch" }, { status: 502 });
  }

  return NextResponse.json(json);
}
