// Step 1 — build 8 VIBRANT, clean-handed COLOR ANCHORS for the v13 LoRA dataset.
// Recolors one vibrant, neck-clean SEED to all 8 robe colors (best-of-3), then runs the
// hand-fix + hood-fix Kontext passes so every anchor has canonical mitts and no neck.
//
// Run:  node --env-file=.env.local scripts/build-bases.mjs [seedImagePath]
// Default seed = the vibrant full-body k-cyan-storm survivor. Pass a real favorite PNG to override.
// Out:  scripts/train-data/dataset-v13/bases/<color>.png (+ .txt captions) + _bases.png contact sheet

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT, DATA, COLORS, VIBRANT_STYLE, KEEP_IDENTITY,
  ensureDir, uploadFile, kontext, handFix, hoodFix, pickBest, saveUrl, saveBuf, contactSheet, gates,
} from "./wizlib.mjs";
import { writeFileSync } from "node:fs";

const SEED = process.argv[2] || join(ROOT, "scripts/train-data/v12-dataset/k-cyan-storm.jpg");
if (!existsSync(SEED)) {
  console.error("Seed image not found:", SEED);
  process.exit(1);
}
const OUT = ensureDir(join(DATA, "bases"));

console.log("Seed:", SEED);
const seedUrl = await uploadFile(SEED, SEED.endsWith(".png") ? "image/png" : "image/jpeg");
console.log("Seed uploaded → fal.storage\n");

async function buildColor([name, desc]) {
  const tag = name.padEnd(7);
  const prompt =
    `Recolor this wizard's robe and hood to ${desc}, repainting the whole picture in a ${VIBRANT_STYLE}. ` +
    `Full body, standing calmly and centered, both hands resting simply at its sides, simple dark atmospheric ` +
    `background. ${KEEP_IDENTITY}`;
  try {
    const cands = await kontext(seedUrl, prompt, { num: 3, guidance: 3.5, aspect: "1:1" });
    if (!cands.length) { console.log(`[${tag}] ⚠ no output`); return null; }
    let best = await pickBest(cands);
    best = await handFix(best); // canonical mitts
    best = await hoodFix(best); // snug hood, no neck
    const file = join(OUT, `${name}.png`);
    await saveUrl(file, best);
    writeFileSync(join(OUT, `${name}.txt`), `wzrdz, a single ${name} Wizardz wizard, standing, hands at its sides`);
    // light QA readout (non-blocking — these are the anchors, the human approves them anyway)
    const [h, n] = await Promise.all([gates.hands(file), gates.neck(file)]);
    console.log(`[${tag}] ✓ ${name}.png   hands:${h ? "ok" : "FLAG"} neck:${n ? "ok" : "FLAG"}`);
    return { path: file, label: `${name}${h ? "" : " hand?"}${n ? "" : " neck?"}` };
  } catch (e) {
    console.log(`[${tag}] ✗ ${e.message}`);
    return null;
  }
}

console.log("Recoloring → hand-fix → hood-fix (8 colors in parallel)…\n");
const results = (await Promise.all(COLORS.map(buildColor))).filter(Boolean);

if (results.length) {
  const sheet = join(DATA, "_bases.png");
  await contactSheet(results, sheet, { cols: 4, cell: 420 });
  console.log(`\n✓ ${results.length}/8 anchors → ${OUT}`);
  console.log(`✓ contact sheet → ${sheet}`);
} else {
  console.log("\n✗ no anchors produced");
}
console.log("\nReview the anchors, then run augment-dataset.mjs.");
