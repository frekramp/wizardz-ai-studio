// Test the on-brand GIF chain: LoRA wizard image -> image-to-video.
// Run: node --env-file=.env.local scripts/test-gif.mjs

import { fal } from "@fal-ai/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.FAL_KEY;
const LORA = process.env.FAL_LORA_URL;
if (!KEY) {
  console.error("Need FAL_KEY");
  process.exit(1);
}
fal.config({ credentials: KEY });
mkdirSync(join(ROOT, "scripts/test"), { recursive: true });

console.log("stage 1 — wizard image (LoRA) …");
const img = await fal.subscribe("fal-ai/flux-lora", {
  input: {
    prompt: "wzrdz, a single blue Wizardz wizard casting a glowing fire spell, simple dark background",
    loras: LORA ? [{ path: LORA, scale: 1 }] : [],
    image_size: "square_hd",
    num_images: 1,
    enable_safety_checker: true,
  },
  logs: false,
});
const imageUrl = img.data.images[0].url;
console.log("   image:", imageUrl);
writeFileSync(
  join(ROOT, "scripts/test/gif-frame.png"),
  Buffer.from(await fetch(imageUrl).then((r) => r.arrayBuffer())),
);

console.log("stage 2 — animate (Kling v2.1, super quality) … (~1-3 min)");
const vid = await fal.subscribe("fal-ai/kling-video/v2.1/standard/image-to-video", {
  input: {
    image_url: imageUrl,
    prompt: "the wizard gently sways and floats in place, robe flowing, magical fire flickering, glowing eyes pulsing — smooth high-quality looping idle animation",
    duration: "5",
  },
  logs: false,
});
const videoUrl = vid.data.video.url;
console.log("   video:", videoUrl);
writeFileSync(
  join(ROOT, "scripts/test/gif-anim.mp4"),
  Buffer.from(await fetch(videoUrl).then((r) => r.arrayBuffer())),
);
console.log("done");
