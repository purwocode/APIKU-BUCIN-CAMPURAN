import { NextResponse } from "next/server";

export async function GET() {
  // fire-and-forget (AMAN)
  import("../../../scripts/proxyWorker.js").then(
    ({ runProxyWorker }) => runProxyWorker()
  );

  return NextResponse.json({
    status: "Proxy refresh started",
  });
}
