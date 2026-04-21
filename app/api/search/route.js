import { NextResponse } from "next/server";
import { fetchSearchResults } from "../../../lib/providers/search.js";

/**
 * GET /api/search?q=<query>
 *
 * Mencari di semua provider (DramaBox, NetShort, Melolo, FlickReels, DramaWave)
 * secara paralel dan menggabungkan hasilnya terdedup.
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "query (q) wajib diisi" }, { status: 400 });
  }

  try {
    const data = await fetchSearchResults(q);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: err?.message || "Unknown error",
        results: [],
        sourceFailed: {
          dramabox: true,
          netshort: true,
          melolo: true,
          flickreels: true,
          dramawave: true,
          reelshort: true,
          shortmax: true,
        },
      },
      { status: 500 }
    );
  }
}
