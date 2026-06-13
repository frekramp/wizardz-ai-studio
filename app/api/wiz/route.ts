import { NextResponse } from "next/server";
import { allNumbers, imageUrlFor, traitTextFor, wizardByNumber, WIZARDZ_MAX_N } from "@/lib/wizardz";

export const runtime = "nodejs";

// Resolve a wizard number → its on-chain art URL + traits (for the Wiz # picker preview).
// Called without `n`, returns the set of minted numbers (for the random button + validation).
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("n");
  if (raw == null) {
    // The minted-number set is immutable (committed index) → safe to cache at the edge.
    return NextResponse.json(
      { ok: true, numbers: allNumbers(), max: WIZARDZ_MAX_N },
      { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
    );
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return NextResponse.json({ ok: false, error: "Bad number." }, { status: 400 });
  }
  const w = wizardByNumber(n);
  if (!w) {
    return NextResponse.json({ ok: false, max: WIZARDZ_MAX_N }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    n,
    imageUrl: imageUrlFor(n),
    traits: traitTextFor(n),
  });
}
