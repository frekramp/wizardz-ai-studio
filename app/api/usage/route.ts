import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { getUsage, clientLimits } from "@/lib/quota";
import { clientIp, usageKey } from "@/lib/request";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = readSession((await cookies()).get("wz_session")?.value);
  const holder = !!session?.holder;
  const key = usageKey(session, clientIp(req));
  return NextResponse.json({ holder, usage: await getUsage(key), limits: clientLimits(holder) });
}
