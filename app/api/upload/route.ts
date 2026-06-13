import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { FAL_ENABLED } from "@/lib/fal";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";

export const runtime = "nodejs";

// Accept a user image (for "recreate this meme"), park it on fal.storage, and hand back
// the URL. /api/generate then conditions kontext on that URL — keeps generate JSON-only.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const OK_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  if (!FAL_ENABLED) {
    return NextResponse.json({ error: "Uploads aren't available right now." }, { status: 503 });
  }

  const ip = clientIp(req);
  if (!(await rateLimit(ip))) {
    return NextResponse.json({ error: "Too many uploads — give it a minute." }, { status: 429 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    /* fall through to the 400 below */
  }

  if (!file) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }
  if (!OK_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Use a PNG, JPG, WEBP or GIF." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8 MB)." }, { status: 413 });
  }

  try {
    const url = await fal.storage.upload(file);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Upload failed." }, { status: 502 });
  }
}
