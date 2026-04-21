import { NextResponse } from "next/server";
import { fetchMeloloEpisodes } from "../../../lib/providers/melolo.js";
import { fetchNetshortEpisodes } from "../../../lib/providers/netshort.js";
import { fetchFlickreelsEpisodes } from "../../../lib/providers/flickreels.js";
import { fetchDramawaveEpisodes } from "../../../lib/providers/dramawave.js";
import { fetchDramaboxEpisodes } from "../../../lib/providers/dramabox.js";
import { fetchReelshortEpisodes } from "../../../lib/providers/reelshort.js";
import { fetchGoodShortEpisodes } from "../../../lib/providers/goodshort-episode.js";
import { fetchFreeReelsEpisodes } from "../../../lib/providers/freereels-episode.js";
import { fetchDramaNovaEpisodes } from "../../../lib/providers/dramanova-episode.js";
import { fetchShortmaxEpisodes } from "../../../lib/providers/shortmax.js";

const PROVIDER_MAP = {
  melolo: fetchMeloloEpisodes,
  netshort: fetchNetshortEpisodes,
  flickreels: fetchFlickreelsEpisodes,
  dramawave: fetchDramawaveEpisodes,
  dramabox: fetchDramaboxEpisodes,
  reelshort: fetchReelshortEpisodes,
  goodshort: fetchGoodShortEpisodes,
  freereels: fetchFreeReelsEpisodes,
  dramanova: fetchDramaNovaEpisodes,
  shortmax: fetchShortmaxEpisodes,
};

const WATERFALL_ORDER = [
  "melolo",
  "netshort",
  "flickreels",
  "dramawave",
  "reelshort",
  "goodshort",
  "freereels",
  "dramanova",
  "shortmax",
  "dramabox",
];

/**
 * GET /api/episode?id=<id>&source=<source>
 *
 * Jika `source` diberikan (mis. dari data home), langsung pakai provider itu.
 * Jika tidak, coba semua provider secara berurutan (waterfall):
 * melolo → netshort → flickreels → dramawave → dramabox
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const source = searchParams.get("source")?.toLowerCase();

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  // Jika source diketahui, langsung panggil provider yang tepat
  if (source && PROVIDER_MAP[source]) {
    const result = await PROVIDER_MAP[source](id);
    if (result) return NextResponse.json(result);
    return NextResponse.json(
      { error: `Episode tidak ditemukan di provider '${source}'` },
      { status: 404 }
    );
  }

  // Waterfall fallback
  for (const key of WATERFALL_ORDER) {
    const result = await PROVIDER_MAP[key](id);
    if (result) return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "ID tidak valid untuk semua provider (Melolo, NetShort, FlickReels, DramaWave, ReelShort, GoodShort, FreeReels, DramaNova, ShortMax, DramaBox)" },
    { status: 404 }
  );
}
