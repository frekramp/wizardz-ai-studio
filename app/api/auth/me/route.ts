import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const store = await cookies();
  const s = readSession(store.get("wz_session")?.value);
  return NextResponse.json(
    s
      ? { connected: true, address: s.address, holder: s.holder, count: s.count }
      : { connected: false },
  );
}
