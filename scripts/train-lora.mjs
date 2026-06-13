// Train a Wizardz CHARACTER LoRA (FLUX.1-dev) on a curated folder of clean, captioned images.
// is_style:false → character mode (keeps fal's captioning + segmentation on); per-image .txt
// caption sidecars are shipped inside the zip. ~20-40 clean, consistent, captioned images ideal.
//
// Run:  node --env-file=.env.local scripts/train-lora.mjs <images-folder> [triggerWord]
//   env: STEPS=1500   CAPTIONS=on|off   (defaults: steps 1500, captions on)
// Prints FAL_LORA_URL=<weights> — paste into .env.local (and Vercel) then restart the studio.

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
const STEPS = Number(process.env.STEPS ?? "1500");
const CAPTIONS = (process.env.CAPTIONS ?? "on") !== "off";
if (!folder || !existsSync(folder)) {
  console.error("Usage: node --env-file=.env.local scripts/train-lora.mjs <images-folder> [triggerWord]");
  process.exit(1);
}

// Character LoRA: ship the .txt caption sidecars too (the OLD glob excluded *.txt, so captions
// never reached the trainer). CAPTIONS=off omits them → the trainer falls back to the trigger word.
const zip = "/tmp/wizardz-train.zip";
const globs = CAPTIONS
  ? "'*.png' '*.jpg' '*.jpeg' '*.webp' '*.txt'"
  : "'*.png' '*.jpg' '*.jpeg' '*.webp'";
execSync(`rm -f "${zip}" && cd "${folder}" && zip -r -q "${zip}" . -i ${globs}`);
console.log(
  `Zipped ${folder} (captions ${CAPTIONS ? "on" : "off"}): ${execSync(`unzip -l "${zip}" | tail -1`).toString().trim()}`,
);

console.log("Uploading dataset …");
const url = await fal.storage.upload(new Blob([readFileSync(zip)], { type: "application/zip" }));

console.log(`\nTraining FLUX character LoRA — trigger "${trigger}", steps ${STEPS}, is_style:false …`);
const res = await fal.subscribe("fal-ai/flux-lora-fast-training", {
  input: {
    images_data_url: url,
    trigger_word: trigger,
    steps: STEPS,
    is_style: false, // CHARACTER mode — keeps captioning + segmentation ON (the v12 bug was `true`)
    create_masks: true,
    data_archive_format: "zip",
  },
  logs: true,
  onQueueUpdate: (u) => {
    const m = u?.logs?.at(-1)?.message;
    if (u.status === "IN_PROGRESS" && m) console.log("   ", m);
  },
});

const lora = res?.data?.diffusers_lora_file?.url;
console.log("\n✅ Training complete.");
if (lora) console.log(`\nFAL_LORA_URL=${lora}\n`);
else {
  console.log("⚠ couldn't find diffusers_lora_file.url — raw output:");
  console.log(JSON.stringify(res.data, null, 2));
}
