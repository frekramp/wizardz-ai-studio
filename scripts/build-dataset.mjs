// Build a clean, diverse LoRA training dataset: single Wizardz wizards,
// every banner color × poses, square, with our dialed-in clean prompt.
//
// Run:  node --env-file=.env.local scripts/build-dataset.mjs
// Output: scripts/dataset/wiz-*.png  (then curate + train)

import { fal } from "@fal-ai/client";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.FAL_KEY;
if (!KEY) {
  console.error("Set FAL_KEY");
  process.exit(1);
}
fal.config({ credentials: KEY });

const MODEL = process.env.FAL_REF_MODEL ?? "fal-ai/flux-pro/kontext";
const REFERENCE = join(ROOT, "public/brand/banner.png");

const STYLE =
  "Match the EXACT art style of the reference image: glossy cel-shaded cartoon/anime. " +
  "ONE single Wizardz wizard, FACELESS — a smooth dark head whose only feature is exactly two identical, symmetrical, " +
  "simple glowing almond-shaped eyes, level and evenly spaced with crisp clean edges and gently upturned outer corners; " +
  "a flowing hooded robe with a curled pointed hood, and neat black cartoon gloves (four plump rounded fingers and a thumb, " +
  "oval stitch lines on the back of the hand, a rounded cuff at the wrist — classic clean cartoon-glove style), well-defined hands. " +
  "Bold clean outlines, vibrant saturated colors, dramatic rim lighting, simple dark cosmic background. Clean well-formed anatomy.";

const COLORS = [
  "bright sky-blue",
  "vivid purple",
  "emerald green",
  "bright orange",
  "hot pink magenta",
  "crimson red",
  "teal cyan",
  "golden yellow",
];
const POSES = [
  "standing calmly facing forward, mitten paws resting at its sides, full body centered",
  "casting a glowing magic spell, one mitten paw gently raised, full body centered",
];

console.log("Uploading banner style reference …");
const refUrl = await fal.storage.upload(
  new Blob([readFileSync(REFERENCE)], { type: "image/png" }),
);
console.log("Reference uploaded ✓\n");

const outDir = join(ROOT, "scripts/dataset");
mkdirSync(outDir, { recursive: true });

let n = 0;
for (const color of COLORS) {
  for (let p = 0; p < POSES.length; p++) {
    n++;
    const name = `wiz-${n.toString().padStart(2, "0")}`;
    console.log(`[${n}] ${color} — pose ${p + 1}`);
    try {
      const res = await fal.subscribe(MODEL, {
        input: {
          image_url: refUrl,
          prompt: `${STYLE}\n\nThe wizard wears a ${color} cloak, ${POSES[p]}.`,
          aspect_ratio: "1:1",
          guidance_scale: 3.5,
          num_images: 1,
        },
        logs: false,
      });
      const url = res?.data?.images?.[0]?.url ?? null;
      if (!url) {
        console.log("   ⚠ no image");
        continue;
      }
      const bytes = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
      writeFileSync(join(outDir, `${name}.png`), bytes);
      console.log(`   ✓ ${name}.png`);
    } catch (e) {
      console.log("   ✗", e.message);
    }
  }
}
console.log(`\nDone — ${n} candidates in scripts/dataset/. Curate, then train.`);
