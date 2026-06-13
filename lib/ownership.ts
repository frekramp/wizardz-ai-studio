import { WIZARDZ_IDS } from "./wizardz-ids";

// Ownership lookup needs a Bitcoin ordinals indexer (the free keyless ones — Hiro,
// Magic Eden — were taken down). Primary: Satflow (SATFLOW_API_KEY), which filters by
// collection server-side. Fallback: Ordiscan (ORDISCAN_API_KEY) + our local ID set.
// Fails CLOSED: if we can't verify, the wallet is treated as a non-holder.

const SATFLOW_BASE = "https://api.satflow.com/v1";
const COLLECTION = process.env.WIZARDZ_COLLECTION_SLUG || "wizardz";

// Satflow filters by collection for us → returns only the Wizardz the wallet holds.
async function satflowWizardz(address: string, key: string): Promise<string[]> {
  const held: string[] = [];
  let cursor = 0;
  for (let i = 0; i < 5; i++) {
    const url =
      `${SATFLOW_BASE}/address/wallet-contents?address=${encodeURIComponent(address)}` +
      `&collection=${encodeURIComponent(COLLECTION)}&itemType=inscription&limit=100&cursor=${cursor}`;
    const res = await fetch(url, { headers: { "x-api-key": key, accept: "application/json" } });
    if (!res.ok) break;
    const data = (await res.json()) as {
      data?: {
        results?: { ordinals?: Array<{ token?: { inscription_id?: string } }> };
        nextCursor?: number | null;
      };
    };
    for (const o of data.data?.results?.ordinals ?? []) {
      const id = o.token?.inscription_id;
      if (id) held.push(id);
    }
    const next = data.data?.nextCursor;
    if (next == null) break;
    cursor = next;
  }
  // Intersect with our authoritative 333-ID set (like the Ordiscan path) — never trust the
  // indexer's collection filter alone to decide holder status.
  return held.filter((id) => WIZARDZ_IDS.has(id));
}

// Ordiscan returns ALL inscriptions for an address → intersect with our local ID set.
async function ordiscanWizardz(address: string, key: string): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= 6; page++) {
    const res = await fetch(
      `https://api.ordiscan.com/v1/address/${encodeURIComponent(address)}/inscriptions?page=${page}`,
      { headers: { Authorization: `Bearer ${key}`, accept: "application/json" } },
    );
    if (!res.ok) break;
    const data = (await res.json()) as {
      data?: Array<{ inscription_id?: string; id?: string }>;
    };
    const batch = (data.data ?? [])
      .map((r) => r.inscription_id ?? r.id)
      .filter((x): x is string => !!x);
    ids.push(...batch);
    if (batch.length === 0) break;
  }
  return ids.filter((id) => WIZARDZ_IDS.has(id));
}

// Short-lived cache of successful (holder) lookups so a transient indexer hiccup doesn't
// instantly de-holder everyone. We deliberately never cache empty/failed results.
const heldCache = new Map<string, { ids: string[]; at: number }>();
const HELD_TTL = 60_000;

// Returns the Wizardz inscription IDs currently held by an address.
export async function wizardzHeldBy(address: string): Promise<string[]> {
  // DEV ONLY: treat any verified wallet as a holder so the unlock UI can be tested
  // without an indexer key. Never honored in production.
  if (process.env.ALLOW_DEV_HOLDER === "1" && process.env.NODE_ENV !== "production") {
    return ["dev-holder"];
  }
  const cached = heldCache.get(address);
  if (cached && Date.now() - cached.at < HELD_TTL) return cached.ids;

  // Try Satflow, then fall back to Ordiscan if it throws OR returns nothing.
  let ids: string[] = [];
  if (process.env.SATFLOW_API_KEY) {
    try {
      ids = await satflowWizardz(address, process.env.SATFLOW_API_KEY);
    } catch {
      /* fall through to Ordiscan */
    }
  }
  if (!ids.length && process.env.ORDISCAN_API_KEY) {
    try {
      ids = await ordiscanWizardz(address, process.env.ORDISCAN_API_KEY);
    } catch {
      /* fail closed below */
    }
  }
  if (ids.length) heldCache.set(address, { ids, at: Date.now() });
  return ids; // no provider configured / all failed → [] (fail closed)
}
