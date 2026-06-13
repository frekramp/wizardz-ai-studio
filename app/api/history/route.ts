import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { kv, kvGetJSON, kvPutJSON } from "@/lib/kv";
import type { HistoryItem } from "@/lib/history";

export const runtime = "nodejs";

// Per-address gallery. Durable via Cloudflare KV in production, in-memory in local dev.
const mem = new Map<string, HistoryItem[]>();
const MAX = 120;

async function load(addr: string): Promise<HistoryItem[]> {
  if (kv()) return (await kvGetJSON<HistoryItem[]>(`h:${addr}`)) ?? [];
  return mem.get(addr) ?? [];
}
async function persist(addr: string, items: HistoryItem[]): Promise<void> {
  if (kv()) await kvPutJSON(`h:${addr}`, items);
  else mem.set(addr, items);
}

async function addressOf(): Promise<string | null> {
  const s = readSession((await cookies()).get("wz_session")?.value);
  return s?.address ?? null;
}

export async function GET() {
  const addr = await addressOf();
  if (!addr) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: await load(addr) });
}

export async function POST(req: Request) {
  const addr = await addressOf();
  if (!addr) return NextResponse.json({ error: "Not connected." }, { status: 401 });
  let item: HistoryItem;
  try {
    item = (await req.json()) as HistoryItem;
  } catch {
    return NextResponse.json({ error: "Bad body." }, { status: 400 });
  }
  if (!item?.id || !Array.isArray(item.urls) || !item.urls.length) {
    return NextResponse.json({ error: "Bad item." }, { status: 400 });
  }
  const items = [item, ...(await load(addr)).filter((i) => i.id !== item.id)].slice(0, MAX);
  await persist(addr, items);
  return NextResponse.json({ ok: true, count: items.length });
}

export async function DELETE(req: Request) {
  const addr = await addressOf();
  if (!addr) return NextResponse.json({ ok: true });
  const id = new URL(req.url).searchParams.get("id");
  if (id) await persist(addr, (await load(addr)).filter((i) => i.id !== id));
  else await persist(addr, []);
  return NextResponse.json({ ok: true });
}
