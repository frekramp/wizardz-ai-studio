// Train the A/B candidate Wizardz character LoRAs on the curated dataset and collect their
// weights URLs into dataset-v13/loras.json. Each run ~$2. Run after curate-dataset.mjs.
//
// Run:  node --env-file=.env.local scripts/ab-train.mjs [curatedFolder]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { DATA, fal } from "./wizlib.mjs";

const folder = process.argv[2] || join(DATA, "curated");
if (!existsSync(folder)) {
  console.error("No curated folder:", folder, "— run curate-dataset.mjs first.");
  process.exit(1);
}
const trigger = "wzrdz";

const ARMS = [
  { tag: "char-cap-1500", steps: 1500, captions: true }, // primary candidate
  { tag: "char-cap-1000", steps: 1000, captions: true }, // under-train check
  { tag: "char-nocap-1500", steps: 1500, captions: false }, // isolates the value of captions
];

// Build + upload the training zip once per caption mode (cached), reused across arms.
const zipCache = {};
async function datasetUrl(captions) {
  const key = captions ? "cap" : "nocap";
  if (zipCache[key]) return zipCache[key];
  const zip = `/tmp/wizardz-train-${key}.zip`;
  const globs = captions
    ? "'*.png' '*.jpg' '*.jpeg' '*.webp' '*.txt'"
    : "'*.png' '*.jpg' '*.jpeg' '*.webp'";
  execSync(`rm -f "${zip}" && cd "${folder}" && zip -r -q "${zip}" . -i ${globs}`);
  console.log(`  zipped (${key}): ${execSync(`unzip -l "${zip}" | tail -1`).toString().trim()}`);
  const url = await fal.storage.upload(new Blob([readFileSync(zip)], { type: "application/zip" }));
  zipCache[key] = url;
  return url;
}

async function train(arm) {
  const url = await datasetUrl(arm.captions);
  console.log(`\n▶ ${arm.tag}: steps ${arm.steps}, captions ${arm.captions ? "on" : "off"} …`);
  const res = await fal.subscribe("fal-ai/flux-lora-fast-training", {
    input: {
      images_data_url: url,
      trigger_word: trigger,
      steps: arm.steps,
      is_style: false,
      create_masks: true,
      data_archive_format: "zip",
    },
    logs: true,
    onQueueUpdate: (u) => {
      if (u.status === "IN_PROGRESS") process.stdout.write(".");
    },
  });
  const lora = res?.data?.diffusers_lora_file?.url ?? null;
  console.log(`\n  ${arm.tag} → ${lora ?? "FAILED"}`);
  return { ...arm, lora };
}

const out = [];
for (const arm of ARMS) {
  try {
    out.push(await train(arm));
  } catch (e) {
    console.log(`\n  ${arm.tag} ✗ ${e.message}`);
    out.push({ ...arm, lora: null, error: e.message });
  }
}
const path = join(DATA, "loras.json");
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(`\n✓ Saved ${out.filter((a) => a.lora).length}/${ARMS.length} LoRA URLs → ${path}`);
console.log("Next: eval-loras.mjs");
