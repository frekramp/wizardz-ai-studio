// Build the # → wizard map for the Wiz # feature, committed as lib/wizardz-index.json
// so the runtime needs no indexer key. Source: Ordinals Wallet's public (keyless) API,
// which returns the canonical collection number (meta.name "wizardz #N") AND full traits
// in one paginated endpoint.
//
// Run:  node scripts/build-wizard-index.mjs [collectionSlug]
//
// Output entry shape: { n, id, attributes?: [{ trait_type, value }] }
//   n  = canonical collection number (#) from meta.name, else inscription-number order
//   id = inscription id (…i0); the art is the keyless https://ord.satflow.com/content/<id>

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://turbo.ordinalswallet.com";
const SLUG = process.argv[2] || "wizardz";
const PAGE = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await sleep(800 * (i + 1));
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  throw new Error(`gave up after ${tries} tries: ${url}`);
}

function numberFromName(name) {
  const m = typeof name === "string" && name.match(/#\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function cleanAttributes(attrs) {
  if (!Array.isArray(attrs)) return undefined;
  const out = attrs
    .map((a) => ({
      trait_type: String(a.trait_type ?? a.type ?? a.key ?? a.name ?? "").trim(),
      value: String(a.value ?? a.trait_value ?? a.val ?? "").trim(),
    }))
    .filter((a) => a.trait_type && a.value);
  return out.length ? out : undefined;
}

console.log(`Fetching "${SLUG}" from Ordinals Wallet …`);
const meta = await getJSON(`${BASE}/collection/${encodeURIComponent(SLUG)}`);
const total = Number(meta?.total_supply) || null;
console.log(`  collection "${meta?.name}" — total_supply ${total ?? "?"}`);

// OW's inscriptions endpoint ignores offset/limit and returns the whole set, so we dedupe by
// id and stop once a page adds nothing new (or we've reached total_supply).
const byId = new Map();
for (let offset = 0; offset < 4000; offset += PAGE) {
  const page = await getJSON(`${BASE}/collection/${encodeURIComponent(SLUG)}/inscriptions?offset=${offset}&limit=${PAGE}`);
  if (!Array.isArray(page) || page.length === 0) break;
  const before = byId.size;
  for (const it of page) if (it?.id) byId.set(it.id, it);
  console.log(`  …${byId.size} unique`);
  if (byId.size === before) break;
  if (total && byId.size >= total) break;
}
const items = [...byId.values()];

if (!items.length) {
  console.error("No inscriptions returned — check the collection slug.");
  process.exit(1);
}

// Sort by inscription number so the index-order fallback is deterministic.
items.sort((a, b) => (a.num ?? 0) - (b.num ?? 0));

const index = items.map((it, i) => {
  const n = numberFromName(it.meta?.name);
  const attributes = cleanAttributes(it.meta?.attributes);
  return {
    n: Number.isInteger(n) ? n : i + 1,
    id: it.id,
    ...(attributes ? { attributes } : {}),
  };
});
index.sort((a, b) => a.n - b.n);

// Sanity: warn on duplicate or missing numbers.
const seen = new Set();
const dupes = [];
for (const w of index) {
  if (seen.has(w.n)) dupes.push(w.n);
  seen.add(w.n);
}
const withTraits = index.filter((w) => w.attributes?.length).length;
const maxN = index.reduce((m, w) => Math.max(m, w.n), 0);

const out = join(ROOT, "lib/wizardz-index.json");
writeFileSync(out, JSON.stringify(index, null, 2) + "\n");
console.log(`\n✅ Wrote ${index.length} wizards → lib/wizardz-index.json`);
console.log(`   #range: 1–${maxN} · with traits: ${withTraits}${dupes.length ? ` · ⚠ duplicate #s: ${[...new Set(dupes)].join(", ")}` : ""}`);
console.log("   Spot-check a few against https://ordinalswallet.com/collection/wizardz, then commit it.");
