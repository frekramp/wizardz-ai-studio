import { getCloudflareContext } from "@opennextjs/cloudflare";

// Durable shared state for Workers. In production the `WIZ_KV` namespace (wrangler binding) backs
// quota / rate-limit / history so they survive restarts AND are shared across isolates — without
// it, each isolate has its own memory and a user can bypass caps by hitting different isolates.
// In plain `next dev` there's no Cloudflare context, so kv() returns null and callers fall back to
// in-memory Maps (dev behaves exactly as before).
//
// NOTE: KV is eventually-consistent and NOT atomic — a read-modify-write (e.g. the quota reserve)
// has a tiny race window across simultaneous requests. Acceptable for a daily quota; for strict
// atomicity, migrate the hot counters to a Durable Object later.

type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export function kv(): KVNamespace | null {
  try {
    const env = getCloudflareContext().env as unknown as { WIZ_KV?: KVNamespace };
    return env?.WIZ_KV ?? null;
  } catch {
    return null; // no Cloudflare context (local `next dev`) → in-memory fallback
  }
}

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  const ns = kv();
  if (!ns) return null;
  try {
    const raw = await ns.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function kvPutJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const ns = kv();
  if (!ns) return;
  try {
    await ns.put(key, JSON.stringify(value), ttlSeconds ? { expirationTtl: ttlSeconds } : undefined);
  } catch {
    /* best effort */
  }
}
