// Generate more Wizardz art in the BANNER illustration style — different areas of the spaceship.
// Uses your banner as a STYLE REFERENCE (FLUX Kontext) so new scenes keep the cel-shaded look.
//
// Run:  node --env-file=.env.local scripts/generate-examples.mjs [limit]
// Output: scripts/examples/scene-*.png  (curate the good ones)

import { fal } from "@fal-ai/client";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.FAL_KEY;
if (!KEY) {
  console.error("Set FAL_KEY (e.g. node --env-file=.env.local ...)");
  process.exit(1);
}
fal.config({ credentials: KEY });

const MODEL = process.env.FAL_REF_MODEL ?? "fal-ai/flux-pro/kontext";
const REFERENCE = join(ROOT, process.env.REF_IMAGE ?? "public/brand/banner.png");
const LIMIT = Number(process.argv[2]) || 99;
const START = Number(process.argv[3]) || 0;

const STYLE =
  "Match the EXACT art style of the reference image: glossy cel-shaded cartoon/anime. " +
  "The wizards are FACELESS — a smooth dark head whose only feature is exactly two identical, symmetrical, simple glowing " +
  "almond-shaped eyes, level and evenly spaced, with crisp clean edges and gently upturned outer corners, " +
  "a flowing hooded robe with a curled pointed hood, and small plain round black mitten paws — solid simple rounded shapes with no fingers and no thumbs, hands resting calmly (not splayed). " +
  "They come in a VARIETY of bright cloak colors — blue, green, purple, orange, and pink (not all the same color). " +
  "Bold clean outlines, vibrant saturated colors, dramatic rim lighting, magical fire/energy FX, cosmic vibe, clean well-formed anatomy.";

const SCENES = [
  "a CLOSE-UP on one or two LARGE hooded wizards on the cockpit / bridge of the Wizardz spaceship, glowing control panels, cosmic starfield through the windshield",
  "a CLOSE-UP on one or two LARGE hooded wizards in the engine room tending a giant glowing magical reactor core, sparks and energy arcs",
  "the galley / potion kitchen — wizards brewing glowing potions over a bubbling cauldron, cozy warm light",
  "the sleeping quarters — wizards napping in glowing pods and hammocks, a sleepy shiba in a fox onesie",
  "the observation deck — wizards lounging by a huge round window watching planets and a nebula",
  "the treasure vault / cargo hold — stacks of golden bitcoin and chests, a wizard guarding, dramatic light",
  "the arcade lounge — wizards playing the WIZARDZ bitcoin slot machine, neon glow, playful",
  "the training dojo — a wizard casting a roaring fire spell, intense magical effects, dynamic action",
];

console.log(`Uploading style reference: ${REFERENCE.replace(ROOT + "/", "")} …`);
const refUrl = await fal.storage.upload(
  new Blob([readFileSync(REFERENCE)], { type: "image/png" }),
);
console.log("Reference uploaded ✓\n");

const outDir = join(ROOT, "scripts/examples");
mkdirSync(outDir, { recursive: true });

const scenes = SCENES.slice(START, START + LIMIT);
let i = START;
for (const scene of scenes) {
  i++;
  console.log(`[${i}/${scenes.length}] ${scene}`);
  try {
    const res = await fal.subscribe(MODEL, {
      input: {
        image_url: refUrl,
        prompt: `${STYLE}\n\nNew scene: ${scene}. Wide cinematic composition.`,
        guidance_scale: 3.5,
        num_images: 1,
      },
      logs: false,
    });
    const url = res?.data?.images?.[0]?.url ?? res?.data?.image?.url ?? null;
    if (!url) {
      console.log("   ⚠ no image returned");
      continue;
    }
    const bytes = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
    writeFileSync(join(outDir, `scene-${i}.png`), bytes);
    console.log(`   ✓ saved scripts/examples/scene-${i}.png`);
  } catch (e) {
    console.log("   ✗ error:", e.message);
  }
}
console.log("\nDone. Review scripts/examples/ and keep the good ones.");
