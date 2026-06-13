// Step 3 — curate the raw variations through the neck / hand / on-model vision gates, copy the
// survivors (+ captions) into curated/, and emit full + hand-zoom + chin-zoom contact sheets for
// human approval BEFORE any training spend. The 8 anchors are pre-fixed → kept automatically.
//
// Run:  node --env-file=.env.local scripts/curate-dataset.mjs
// Out:  scripts/train-data/dataset-v13/curated/*  +  _curated.png / _curated_hands.png / _curated_chin.png

import { existsSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, ensureDir, gates, contactSheet } from "./wizlib.mjs";

const BASES = join(DATA, "bases");
const RAW = join(DATA, "raw");
const CUR = ensureDir(join(DATA, "curated"));

const pngs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")) : []);

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]); }
  }));
}

function keep(srcDir, name) {
  copyFileSync(join(srcDir, name), join(CUR, name));
  const txt = name.replace(/\.png$/, ".txt");
  if (existsSync(join(srcDir, txt))) copyFileSync(join(srcDir, txt), join(CUR, txt));
}

// Anchors are already hand-/hood-fixed and human-eyeballed → keep them all.
for (const f of pngs(BASES)) keep(BASES, f);
const anchorCount = pngs(BASES).length;
const sheetItems = pngs(BASES).map((f) => ({ path: join(CUR, f), label: `${f.replace(".png", "")} ⚓` }));

// Gate every raw variation: keep only if hands AND neck AND on-model all pass.
const raw = pngs(RAW);
console.log(`Anchors kept: ${anchorCount}. Gating ${raw.length} raw variations…\n`);
let kept = 0, dropped = 0;
await pool(raw, 6, async (f) => {
  const p = join(RAW, f);
  try {
    const [h, n, m] = await Promise.all([gates.hands(p), gates.neck(p), gates.onModel(p)]);
    const ok = h && n && m;
    console.log(`  ${ok ? "✓ keep" : "✗ drop"} ${f.padEnd(20)} hands:${h ? "ok" : "x"} neck:${n ? "ok" : "x"} model:${m ? "ok" : "x"}`);
    if (ok) { keep(RAW, f); kept++; sheetItems.push({ path: join(CUR, f), label: f.replace(".png", "") }); }
    else dropped++;
  } catch (e) { console.log(`  ? ${f} ${e.message}`); dropped++; }
});

const total = anchorCount + kept;
console.log(`\nCurated: ${anchorCount} anchors + ${kept} variations = ${total} images (dropped ${dropped}) → ${CUR}`);

// Approval sheets: full frame + a zoom on the hands + a zoom on the chin/neck.
const cols = 6, cell = 320;
await contactSheet(sheetItems, join(DATA, "_curated.png"), { cols, cell });
await contactSheet(sheetItems, join(DATA, "_curated_hands.png"), { cols, cell, region: { l: 0.08, t: 0.5, w: 0.84, h: 0.46 } });
await contactSheet(sheetItems, join(DATA, "_curated_chin.png"), { cols, cell, region: { l: 0.28, t: 0.2, w: 0.44, h: 0.42 } });
console.log("Approval sheets: _curated.png, _curated_hands.png, _curated_chin.png");
console.log("Eyeball them — then train (ab-train.mjs).");
