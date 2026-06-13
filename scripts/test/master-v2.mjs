// Test the v2 master prompt: identity LOCKED (no neck, robe/eyes/mitts/style intact)
// but pose + props + scene FREE, so the actual request renders.
//
// Run:  node --env-file=.env.local scripts/test/master-v2.mjs
// Output: public/necktest-v2/*.png  (open them; the user's eye is the judge)

import { fal } from "@fal-ai/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KEY = process.env.FAL_KEY;
const MASTER = process.env.FAL_MASTER_URL;
if (!KEY || !MASTER) {
  console.error("Need FAL_KEY + FAL_MASTER_URL in .env.local");
  process.exit(1);
}
fal.config({ credentials: KEY });

// v2 prompt: hard-lock the identity (esp. the no-neck hood geometry + robe), free everything else.
function masterV2(request) {
  return (
    "Transform this exact wizard into a new illustration that clearly depicts the request below, " +
    "while keeping its IDENTITY perfectly intact. " +
    "KEEP IDENTICAL — do NOT change: the dark featureless face with two large glowing white oval " +
    "eyes; the hood wrapping snugly around the face and framing it on EVERY side INCLUDING directly " +
    "under the chin, so NO neck, throat or skin is ever visible below the face; the smooth black " +
    "mitten gloves; the simple one-piece A-line hooded robe with a curled pointed hood tip and " +
    "smooth sides (no cape, no side flaps); and the glossy cel-shaded cartoon art style with bold " +
    "clean outlines, vibrant colours and soft cinematic lighting. " +
    "YOU MAY freely change to fulfil the request: the wizard's pose and body position, what its " +
    "hands hold or do, any props or objects, and the entire background and scene. The requested " +
    "action and setting must be obviously visible. " +
    `Request: ${request}`
  );
}

const PROMPTS = [
  ["surfboard", "riding a cosmic surfboard through a pink starry galaxy"],
  ["spell", "casting a glowing magic spell with sparkles, in a dark enchanted forest at night"],
  ["spellbook", "sitting cross-legged reading a glowing spellbook on an alien planet under two moons"],
  ["broom", "flying on a wooden broomstick over a neon cyberpunk city skyline at night"],
];

const OUT = join(ROOT, "public/necktest-v2");
mkdirSync(OUT, { recursive: true });

for (const [name, req] of PROMPTS) {
  process.stdout.write(`generating ${name} … `);
  try {
    const r = await fal.subscribe(process.env.FAL_EDIT_MODEL ?? "fal-ai/flux-pro/kontext", {
      input: {
        image_url: MASTER,
        prompt: masterV2(req),
        guidance_scale: 3.5,
        num_images: 1,
        safety_tolerance: "5",
      },
    });
    const url = r?.data?.images?.[0]?.url;
    if (!url) throw new Error("no image url in response");
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    writeFileSync(join(OUT, `${name}.png`), buf);
    console.log("✓");
  } catch (e) {
    console.log("✗ " + (e?.message || e));
  }
}
console.log("\nDone → public/necktest-v2/");
