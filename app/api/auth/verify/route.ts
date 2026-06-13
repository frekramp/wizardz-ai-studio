import { NextResponse } from "next/server";
import { Verifier } from "bip322-js";
import { verifyToken, makeSession } from "@/lib/session";
import { wizardzHeldBy } from "@/lib/ownership";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { address?: string; signature?: string; message?: string; token?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const { address, signature, message, token } = body;
  if (!address || !signature || !message || !token) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }
  // message integrity (untampered) + freshness + address binding
  if (!verifyToken(message, token)) {
    return NextResponse.json({ error: "Invalid challenge." }, { status: 400 });
  }
  // Short freshness window shrinks the replay surface. NOTE: the challenge is stateless, so this
  // is not true single-use — full anti-replay needs a KV/DO nonce store (see DEPLOY notes).
  const issued = /Issued: (\d+)/.exec(message);
  if (!issued || Date.now() - Number(issued[1]) > 2 * 60 * 1000) {
    return NextResponse.json({ error: "Challenge expired — try again." }, { status: 400 });
  }
  if (!message.includes(`Address: ${address}`)) {
    return NextResponse.json({ error: "Address mismatch." }, { status: 400 });
  }
  // BIP-322 signature check
  let valid = false;
  try {
    valid = Verifier.verifySignature(address, message, signature);
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Signature did not verify." }, { status: 401 });
  }
  // live ownership check
  const ids = await wizardzHeldBy(address);
  const res = NextResponse.json({ holder: ids.length > 0, count: ids.length, address });
  res.cookies.set("wz_session", makeSession(address, ids.length), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 3600,
  });
  return res;
}
