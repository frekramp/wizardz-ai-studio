// Best-effort rate limiter. Durable + cross-isolate via Cloudflare KV in production (lib/kv.ts),
// in-memory in local dev. KV is eventually-consistent so the window is approximate under a burst —
// fine as an abuse speed-bump (pair with Turnstile on the public teaser for real protection).

import { kv, kvGetJSON, kvPutJSON } from "./kv";

const mem = new Map<string, number[]>();

export async function rateLimit(key: string, max = 8, windowMs = 5 * 60 * 1000): Promise<boolean> {
  const now = Date.now();
  if (kv()) {
    const arr = (await kvGetJSON<number[]>(`rl:${key}`)) ?? [];
    const recent = arr.filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      await kvPutJSON(`rl:${key}`, recent, Math.ceil(windowMs / 1000));
      return false;
    }
    recent.push(now);
    await kvPutJSON(`rl:${key}`, recent, Math.ceil(windowMs / 1000));
    return true;
  }
  const recent = (mem.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    mem.set(key, recent);
    return false;
  }
  recent.push(now);
  mem.set(key, recent);
  return true;
}
