import { NextResponse } from "next/server";
import { signToken } from "@/lib/session";

export const runtime = "nodejs";

// Issue a signed challenge for the wallet to sign (stateless; integrity via HMAC token).
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  // BTC addresses are alphanumeric (base58 / bech32). Reject anything else so a crafted value
  // can't inject newlines / a second "Issued:" line into the signed challenge.
  if (!/^[a-zA-Z0-9]{20,100}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  }
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2) + ts.toString(36);
  const message = `Sign in to Wizardz Studio\n\nAddress: ${address}\nIssued: ${ts}\nNonce: ${rand}`;
  return NextResponse.json({ message, token: signToken(message) });
}
