import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Same-origin proxy so the browser (ffmpeg.wasm) can fetch fal media without CORS.
// Whitelisted to fal hosts to avoid being an open proxy / SSRF.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const url = params.get("url");
  const download = params.get("download");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (!/(^|\.)fal\.media$/i.test(host)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  // Don't follow redirects — the allowlist only validated the INITIAL host, so a redirect
  // (e.g. via an open *.fal.run function) could send us to an arbitrary/internal target.
  const upstream = await fetch(url, { redirect: "manual" });
  if (upstream.status >= 300 && upstream.status < 400) {
    return NextResponse.json({ error: "redirect not allowed" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  if (!/^(image|video)\//i.test(contentType)) {
    return NextResponse.json({ error: "unsupported content type" }, { status: 415 });
  }
  const headers: Record<string, string> = {
    "content-type": contentType,
    "cache-control": "public, max-age=3600",
  };
  if (download) {
    headers["content-disposition"] = `attachment; filename="${download.replace(/[^\w.-]/g, "_")}"`;
  }
  return new Response(upstream.body, { headers });
}
