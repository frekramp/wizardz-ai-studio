import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

// AUTH_SECRET signs holder sessions. Resolved LAZILY on first use (a request) rather than at
// module load, so a missing secret fails the request loudly — never the build (Cloudflare
// secrets aren't present at build time, and `process.env.NODE_ENV` is inlined as "production").
// If unset in prod we throw; in dev we fall back to a RANDOM per-process key (never a known
// constant, so sessions still can't be forged from the public source). Set it in prod via
// `wrangler secret put AUTH_SECRET` so sessions persist across instances.
let _secret: string | null = null;
function secret(): string {
  if (_secret) return _secret;
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  _secret = s || randomBytes(32).toString("hex");
  return _secret;
}

function hmac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signToken(payload: string): string {
  return hmac(payload);
}

export function verifyToken(payload: string, token: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(hmac(payload)), Buffer.from(token));
  } catch {
    return false;
  }
}

// Short-lived capability that binds a fal requestId to its submitter (`sub` = the quota key:
// `h:<addr>` or `ip:<ip>`), so /api/status only returns a job's result to the caller who
// created it — and only briefly, bounding the impact if the claim ever leaks.
const CLAIM_TTL = 15 * 60 * 1000;
// Sign a delimiter-safe JSON encoding (not `a.b.c`) so the field boundaries can't be confused
// (e.g. requestId="a.b",sub="c" vs requestId="a",sub="b.c" — and `sub` legitimately has dots).
const claimPayload = (requestId: string, sub: string, exp: number) =>
  JSON.stringify([requestId, sub, exp]);
export function makeClaim(requestId: string, sub: string): string {
  const exp = Date.now() + CLAIM_TTL;
  return `${exp}.${hmac(claimPayload(requestId, sub, exp))}`;
}
export function verifyClaim(requestId: string, sub: string, claim?: string | null): boolean {
  if (!claim) return false;
  const dot = claim.indexOf(".");
  if (dot < 0) return false;
  const exp = Number(claim.slice(0, dot));
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return verifyToken(claimPayload(requestId, sub, exp), claim.slice(dot + 1));
}

export type Session = { address: string; holder: boolean; count: number; exp: number };

export function makeSession(address: string, count: number): string {
  const body: Session = {
    address,
    holder: count > 0,
    count,
    exp: Date.now() + 24 * 3600 * 1000,
  };
  const b = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${b}.${hmac(b)}`;
}

export function readSession(token?: string | null): Session | null {
  if (!token) return null;
  const [b, sig] = token.split(".");
  if (!b || !sig || !verifyToken(b, sig)) return null;
  try {
    const s = JSON.parse(Buffer.from(b, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}
