// Test the trained Wizardz LoRA with fresh prompts via flux-lora.
// Run:  node --env-file=.env.local scripts/test-lora.mjs

import { fal } from "@fal-ai/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.FAL_KEY;
const LORA = process.env.FAL_LORA_URL;
if (!KEY || !LORA) {
  console.error("Need FAL_KEY + FAL_LORA_URL in .env.local");
  process.exit(1);
}
fal.config({ credentials: KEY });
const SCALE = Number(process.env.FAL_LORA_SCALE ?? "1");

const TESTS = [
  "wzrdz, a single blue hooded Wizardz wizard casting a glowing fire spell, cosmic background",
  "wzrdz, a single orange Wizardz wizard holding a glowing magic staff, simple dark background",
  "wzrdz, a Wizardz wizard riding a surfboard on a glowing cosmic wave",
];

mkdirSync(join(ROOT, "scripts/test"), { recursive: true });
let i = 0;
for (const prompt of TESTS) {
  i++;
  console.log(`[${i}] ${prompt}`);
  try {
    const res = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt,
        loras: [{ path: LORA, scale: SCALE }],
        image_size: "square_hd",
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: false,
    });
    const url = res?.data?.images?.[0]?.url;
    if (!url) {
      console.log("   ⚠ no image");
      continue;
    }
    writeFileSync(
      join(ROOT, `scripts/test/test-${i}.png`),
      Buffer.from(await fetch(url).then((r) => r.arrayBuffer())),
    );
    console.log(`   ✓ test-${i}.png`);
  } catch (e) {
    console.log("   ✗", e.message);
  }
}
console.log("\nDone.");
