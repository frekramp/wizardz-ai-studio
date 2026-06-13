// Train a Wizardz style LoRA (FLUX.2) on a folder of your real key-art images.
// The more high-quality, on-style images the better (~10-30 ideal).
//
// Run:  FAL_KEY=xxx node scripts/train-lora.mjs <images-folder> [triggerWord]
// Then: copy the printed LoRA URL into FAL_LORA_URL in .env.local and restart the studio.

import { fal } from "@fal-ai/client";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const KEY = process.env.FAL_KEY;
if (!KEY) {
  console.error("Set FAL_KEY (https://fal.ai/dashboard/keys)");
  process.exit(1);
}
fal.config({ credentials: KEY });

const folder = process.argv[2];
const trigger = process.argv[3] ?? "wzrdz";
if (!folder || !existsSync(folder)) {
  console.error("Usage: FAL_KEY=xxx node scripts/train-lora.mjs <images-folder> [triggerWord]");
  process.exit(1);
}

const zip = "/tmp/wizardz-train.zip";
execSync(`rm -f "${zip}" && cd "${folder}" && zip -r -q "${zip}" . -i '*.png' '*.jpg' '*.jpeg' '*.webp'`);
const count = execSync(`unzip -l "${zip}" | tail -1`).toString().trim();
console.log(`Zipped training set (${count}) → ${zip}`);

console.log("Uploading dataset …");
const url = await fal.storage.upload(
  new Blob([readFileSync(zip)], { type: "application/zip" }),
);
console.log("Dataset URL:", url);

console.log(`\nTraining FLUX style LoRA (trigger: "${trigger}") — this takes a few minutes …`);
const res = await fal.subscribe("fal-ai/flux-lora-fast-training", {
  input: { images_data_url: url, trigger_word: trigger, steps: 1000, is_style: true },
  logs: true,
  onQueueUpdate: (u) => {
    const m = u?.logs?.at(-1)?.message;
    if (u.status === "IN_PROGRESS" && m) console.log("   ", m);
  },
});

console.log("\n✅ Training complete. Output:");
console.log(JSON.stringify(res.data, null, 2));
console.log(
  "\nCopy the LoRA weights URL above into .env.local as FAL_LORA_URL=… then restart `npm run dev`.",
);
