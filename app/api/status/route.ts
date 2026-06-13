import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { cookies } from "next/headers";
import { extractOutput, vetVariants } from "@/lib/fal";
import { pickBest } from "@/lib/openai";
import { readSession, verifyClaim } from "@/lib/session";
import { clientIp, usageKey } from "@/lib/request";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");
  const model = searchParams.get("model");
  const claim = searchParams.get("claim");
  if (!requestId || !model) {
    return NextResponse.json({ error: "Missing requestId or model." }, { status: 400 });
  }
  // The claim (issued by /api/generate) binds this requestId to its submitter and expires, so a
  // caller can't read someone else's job result by guessing/observing their requestId.
  const session = readSession((await cookies()).get("wz_session")?.value);
  const sub = usageKey(session, clientIp(req));
  if (!verifyClaim(requestId, sub, claim)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const status = await fal.queue.status(model, { requestId, logs: false });
    if (status.status !== "COMPLETED") {
      // IN_QUEUE | IN_PROGRESS
      return NextResponse.json({ status: status.status });
    }

    const result = await fal.queue.result(model, { requestId });
    const output = extractOutput(result.data);
    if (!output) {
      return NextResponse.json(
        { status: "COMPLETED", error: "No output returned." },
        { status: 502 },
      );
    }
    // Quality gate: filter gross-failure tiles, then auto-pick the single cleanest (best-of-N) so
    // the user gets one polished image with no floating-blob / glitch artifacts.
    let urls = output.urls;
    if (output.kind === "image") {
      const vetted = await vetVariants(output.urls);
      urls = vetted.length > 1 ? [await pickBest(vetted)] : vetted;
    }
    return NextResponse.json({ status: "COMPLETED", urls, kind: output.kind });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Status check failed." },
      { status: 502 },
    );
  }
}
