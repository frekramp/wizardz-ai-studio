// Step 2 — augment the 8 color anchors into pose/scene/expression variations (vibrant),
// each run through the hand-fix Kontext pass. Biased toward hand-light compositions.
//
// Run:  node --env-file=.env.local scripts/augment-dataset.mjs
// In:   scripts/train-data/dataset-v13/bases/<color>.png
// Out:  scripts/train-data/dataset-v13/raw/<color>-<scene>.png (+ .txt captions)

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DATA, COLORS, VIBRANT_STYLE, KEEP_IDENTITY,
  ensureDir, uploadFile, kontext, handFix, pickBest, saveUrl, gates,
} from "./wizlib.mjs";

const BASES = join(DATA, "bases");
const RAW = ensureDir(join(DATA, "raw"));

// [slug, action (what it's doing — also the caption tail), background]. Mostly hand-light.
const SCENES = [
  ["orb", "cradling a large glowing magic orb in both mitten hands", "a dark starry cosmic background"],
  ["coffee", "holding a steaming coffee mug with both mitten hands", "a cozy room with warm window glow"],
  ["spellbook", "reading an open glowing spellbook held in both hands", "a dark enchanted forest with a candle"],
  ["coin", "holding up a glowing golden Bitcoin coin in one mitten hand", "a clear starry night sky"],
  ["spark", "one mitten hand raised casting a small glowing magic spark", "a stormy night sky with lightning"],
  ["snow", "one upturned mitten hand catching a single falling snowflake", "a snowy pine forest at night with stars"],
  ["dungeon", "sitting cozily wrapped in its robe, hands tucked into its sleeves, a glowing skull beside it", "a stone dungeon at night under moonlight"],
  ["galaxy", "floating and meditating peacefully, both mitten hands resting together", "a deep starry galaxy with nebula clouds"],
];

// Expressive eye moods rotated for variety (the "banger" recipe).
const MOODS = ["happy curved glowing eyes", "cozy half-closed glowing eyes", "curious wide glowing eyes", "calm glowing eyes"];

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]); }
  }));
}

const colors = COLORS.filter(([name]) => existsSync(join(BASES, `${name}.png`)));
if (!colors.length) {
  console.error("No anchors found in", BASES, "— run build-bases.mjs first.");
  process.exit(1);
}

// Upload each anchor once, then reuse its fal URL for every scene.
const anchorUrl = {};
for (const [name] of colors) anchorUrl[name] = await uploadFile(join(BASES, `${name}.png`), "image/png");

const work = [];
for (const [name] of colors) for (let s = 0; s < SCENES.length; s++) work.push({ name, s });
console.log(`Generating ${work.length} variations (${colors.length} colors × ${SCENES.length} scenes)…\n`);

let done = 0;
await pool(work, 6, async ({ name, s }) => {
  const [slug, action, bg] = SCENES[s];
  const mood = MOODS[(name.length + s) % MOODS.length];
  const out = `${name}-${slug}`;
  const prompt =
    `Transform this wizard so it is ${action}, in ${bg}. Change the pose, scene and background to match the ` +
    `description, but ${KEEP_IDENTITY} Give it ${mood}. Render everything in a ${VIBRANT_STYLE}.`;
  try {
    const cands = await kontext(anchorUrl[name], prompt, { num: 2, guidance: 3.5, aspect: "1:1" });
    if (!cands.length) { console.log(`  ⚠ ${out} no output`); return; }
    let best = await pickBest(cands);
    if (!(await gates.hands(best))) best = await handFix(best); // only fix bad hands; keep good scenes intact
    await saveUrl(join(RAW, `${out}.png`), best);
    writeFileSync(join(RAW, `${out}.txt`), `wzrdz, a single ${name} Wizardz wizard ${action}`);
    console.log(`  ✓ ${out}.png  (${++done}/${work.length})`);
  } catch (e) {
    console.log(`  ✗ ${out} ${e.message}`);
  }
});

console.log(`\nDone — ${done} raw variations in ${RAW}. Next: curate-dataset.mjs`);
