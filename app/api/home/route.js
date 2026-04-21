import { NextResponse } from "next/server";
import { fetchHomeData } from "../../../lib/providers/home.js";

/**
 * GET /api/home
 *
 * Menggabungkan data dari NetShort, DramaBox, Melolo, FlickReels, DramaWave
 * menjadi satu daftar sections terdedup.
 */
export async function GET() {
  try {
    const data = await fetchHomeData();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { sections: [], error: err?.message || "ERROR" },
      { status: 500 }
    );
  }
}
