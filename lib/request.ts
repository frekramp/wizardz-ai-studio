import type { Session } from "./session";

// Trusted client IP. On Cloudflare Workers the caller can spoof `X-Forwarded-For` (its first
// entry is attacker-controlled), so prefer `CF-Connecting-IP` / `True-Client-IP`. XFF is only
// a last resort for local dev / other proxies.
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("true-client-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  );
}

// Quota/identity key: a holder is keyed by wallet address, everyone else by IP.
export function usageKey(session: Session | null, ip: string): string {
  return session?.holder && session.address ? `h:${session.address}` : `ip:${ip}`;
}
