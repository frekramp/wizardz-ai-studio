// Upload the 13 eye-trait PNGs to fal.storage → paste the printed EYE_URLS map into lib/fal.ts.
// applyEyes() reads the eye art from these URLs (not the local public/ folder) so the overlay works in
// Vercel serverless, where public/ files aren't on the function filesystem. Re-run whenever the eye art
// changes and update EYE_URLS. Run: node --env-file=.env.local scripts/upload-eyes.mjs
import { fal } from "@fal-ai/client";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.FAL_KEY;
if (!KEY) {
  console.error("Set FAL_KEY (run with --env-file=.env.local)");
  process.exit(1);
}
fal.config({ credentials: KEY });

const KEYS = ["rage", "wut", "flame", "diamond", "fent", "sleepy", "joy", "stoic", "wide", "focused", "loopy", "stern", "og"];
const dir = join(ROOT, "public/brand/eyes");

const out = {};
for (const k of KEYS) {
  const file = join(dir, `${k}.png`);
  if (!existsSync(file)) {
    console.error(`MISSING ${file}`);
    process.exit(1);
  }
  out[k] = await fal.storage.upload(new Blob([readFileSync(file)], { type: "image/png" }));
  console.log(`  ✓ ${k}`);
}

console.log("\n✅ Paste into lib/fal.ts (EYE_URLS):\n");
console.log("const EYE_URLS: Record<string, string> = {");
for (const k of KEYS) console.log(`  ${k}: "${out[k]}",`);
console.log("};");
