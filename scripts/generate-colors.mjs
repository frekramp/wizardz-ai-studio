// Generate single-wizard COLOR VARIATIONS matched to the banner palette,
// in the banner illustration style (Kontext + banner as style reference).
//
// Run:  node --env-file=.env.local scripts/generate-colors.mjs

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
  "A FACELESS wizard — a smooth dark head with ONLY two simple glowing almond eyes (no mouth, no nose), " +
  "a flowing hooded robe with a curled pointed hood, and simple rounded mitten hands with NO separate fingers. " +
  "Bold clean outlines, vibrant saturated colors, dramatic rim lighting, cosmic vibe, clean well-formed anatomy.";

// Colors pulled straight from the banner
const COLORS = [
  ["blue", "bright sky-blue"],
  ["purple", "vivid purple"],
  ["green", "emerald green"],
  ["orange", "bright orange"],
  ["pink", "hot pink / magenta"],
  ["red", "crimson red"],
];

console.log("Uploading banner as style reference …");
const refUrl = await fal.storage.upload(
  new Blob([readFileSync(REFERENCE)], { type: "image/png" }),
);
console.log("Reference uploaded ✓\n");

const outDir = join(ROOT, "scripts/examples");
mkdirSync(outDir, { recursive: true });

for (const [name, desc] of COLORS) {
  console.log(`color: ${name}`);
  try {
    const res = await fal.subscribe(MODEL, {
      input: {
        image_url: refUrl,
        prompt: `${STYLE}\n\nNew subject: ONE single Wizardz wizard in a ${desc} hooded cloak, full body, standing, centered, simple dark cosmic background.`,
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
    writeFileSync(join(outDir, `color-${name}.png`), bytes);
    console.log(`   ✓ color-${name}.png`);
  } catch (e) {
    console.log("   ✗", e.message);
  }
}
console.log("\nDone.");
