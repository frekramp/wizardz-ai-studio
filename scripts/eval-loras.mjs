// Evaluate the A/B candidate LoRAs: run a fixed prompt battery through each, build labeled
// per-prompt grids, and pick the winner with the gpt-4.1-mini judge + a clean-hands score.
//
// Run:  node --env-file=.env.local scripts/eval-loras.mjs
// In:   scripts/train-data/dataset-v13/loras.json   Out: scripts/test/eval/grid-*.png + winner.json

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, DATA, ensureDir, fluxLora, saveUrl, pickBest, gates, contactSheet } from "./wizlib.mjs";

const loraFile = join(DATA, "loras.json");
if (!existsSync(loraFile)) { console.error("Run ab-train.mjs first (no loras.json)."); process.exit(1); }
const arms = JSON.parse(readFileSync(loraFile, "utf8")).filter((a) => a.lora);
if (!arms.length) { console.error("No trained LoRAs in loras.json."); process.exit(1); }
const OUT = ensureDir(join(ROOT, "scripts/test/eval"));
const SCALE = Number(process.env.FAL_LORA_SCALE ?? "1");

// Battery that stresses the known failure modes: hands (cast/staff/orb), framing (surf/full body),
// eyes (bust), and color fidelity.
const PROMPTS = [
  ["fireball", "wzrdz, a single blue Wizardz wizard casting a glowing fireball with one raised mitten hand, full body, dark cosmic background"],
  ["staff", "wzrdz, a single green Wizardz wizard holding a glowing magic staff in both mitten hands, starry night"],
  ["coffee", "wzrdz, a single red Wizardz wizard holding a steaming coffee mug, cozy room, warm window light"],
  ["surf", "wzrdz, a single orange Wizardz wizard surfing a glowing cosmic wave on a surfboard, full body"],
  ["orb", "wzrdz, a single purple Wizardz wizard cradling a glowing magic orb in both mitten hands, night, crescent moon"],
  ["bust", "wzrdz, a single white Wizardz wizard, close-up portrait, glowing eyes, snowy pine forest"],
];

console.log(`Evaluating ${arms.length} LoRAs over ${PROMPTS.length} prompts…\n`);
const results = []; // {slug, tag, path}
for (const [slug, prompt] of PROMPTS) {
  for (const arm of arms) {
    try {
      const urls = await fluxLora(prompt, arm.lora, { scale: SCALE, num: 1 });
      if (!urls.length) { console.log(`  ⚠ ${slug}/${arm.tag} no image`); continue; }
      const file = join(OUT, `${slug}__${arm.tag}.png`);
      await saveUrl(file, urls[0]);
      results.push({ slug, tag: arm.tag, path: file });
      console.log(`  ✓ ${slug} / ${arm.tag}`);
    } catch (e) { console.log(`  ✗ ${slug}/${arm.tag} ${e.message}`); }
  }
}

// per-prompt labeled grid + judge a winner
const wins = {};
for (const [slug] of PROMPTS) {
  const items = results.filter((r) => r.slug === slug);
  if (!items.length) continue;
  await contactSheet(items.map((r) => ({ path: r.path, label: r.tag })), join(OUT, `grid-${slug}.png`), { cols: items.length, cell: 420 });
  const best = await pickBest(items.map((r) => r.path));
  const winner = items.find((r) => r.path === best) ?? items[0];
  wins[winner.tag] = (wins[winner.tag] ?? 0) + 1;
  console.log(`  ${slug}: winner → ${winner.tag}`);
}

// clean-hands score per arm (how many of its images pass the hand gate)
const handScore = {};
for (const arm of arms) {
  const imgs = results.filter((r) => r.tag === arm.tag);
  let ok = 0;
  for (const r of imgs) if (await gates.hands(r.path)) ok++;
  handScore[arm.tag] = `${ok}/${imgs.length}`;
}

console.log("\n=== A/B results ===");
for (const arm of arms) console.log(`  ${arm.tag.padEnd(18)} wins:${wins[arm.tag] ?? 0}  clean-hands:${handScore[arm.tag]}`);
const champ = Object.entries(wins).sort((a, b) => b[1] - a[1])[0]?.[0] ?? arms[0].tag;
const champUrl = arms.find((a) => a.tag === champ)?.lora;
writeFileSync(join(DATA, "winner.json"), JSON.stringify({ tag: champ, lora: champUrl, wins, handScore }, null, 2));
console.log(`\n🏆 Winner: ${champ}\nFAL_LORA_URL=${champUrl}`);
console.log(`Grids in ${OUT} (grid-*.png) — review, then wire FAL_LORA_URL in.`);
