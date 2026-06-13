// Per-identity daily generation quotas.
//
// Free (non-holder):  3 images/day + 1 GIF/day
// Holder:             unlimited images + 10 GIFs/day
//
// Durable in production via Cloudflare KV (lib/kv.ts), in-memory in local dev. KV reserve is a
// read-modify-write, so it's not perfectly atomic across simultaneous requests — fine for a daily
// cap; a Durable Object is the upgrade if strict atomicity is ever needed.

import { kv, kvGetJSON, kvPutJSON } from "./kv";

export type GenMode = "image" | "gif";

type Rec = { day: number; image: number; gif: number };
const mem = new Map<string, Rec>();
const DAY_MS = 86_400_000;
const REC_TTL = 2 * 24 * 3600; // 2 days — KV auto-cleans yesterday's records

function today(): number {
  return Math.floor(Date.now() / DAY_MS);
}
const fresh = (): Rec => ({ day: today(), image: 0, gif: 0 });

async function read(key: string): Promise<Rec> {
  const d = today();
  if (kv()) {
    const r = await kvGetJSON<Rec>(`q:${key}`);
    return r && r.day === d ? r : fresh();
  }
  let r = mem.get(key);
  if (!r || r.day !== d) {
    r = fresh();
    mem.set(key, r);
  }
  return r;
}

async function write(key: string, r: Rec): Promise<void> {
  if (kv()) await kvPutJSON(`q:${key}`, r, REC_TTL);
  else mem.set(key, r);
}

export function limitsFor(holder: boolean): { image: number; gif: number } {
  if (holder) return { image: Infinity, gif: 10 };
  // Local dev: lift the free cap so it never interrupts testing. Production stays 3/day.
  if (process.env.NODE_ENV !== "production") return { image: Infinity, gif: 50 };
  return { image: 3, gif: 1 };
}

export async function getUsage(key: string): Promise<{ image: number; gif: number }> {
  const r = await read(key);
  return { image: r.image, gif: r.gif };
}

// Reserve `n` credits if it won't exceed `limit`. Refunded if the downstream call fails before a
// billed result is delivered.
export async function tryReserve(key: string, mode: GenMode, n: number, limit: number): Promise<boolean> {
  const r = await read(key);
  if (r[mode] + n > limit) return false;
  r[mode] += n;
  await write(key, r);
  return true;
}

export async function refund(key: string, mode: GenMode, n: number): Promise<void> {
  const r = await read(key);
  r[mode] = Math.max(0, r[mode] - n);
  await write(key, r);
}

// Serialize Infinity → null ("unlimited") for JSON responses.
export function clientLimits(holder: boolean): { image: number | null; gif: number } {
  const l = limitsFor(holder);
  return { image: l.image === Infinity ? null : l.image, gif: l.gif };
}
