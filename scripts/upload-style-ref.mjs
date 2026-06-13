// Upload the brand banner to fal.storage once → use the printed URL as FAL_STYLE_REF_URL.
// Optional: only the no-LoRA fallback path (lib/fal.ts imageRequest) uses it. With a trained
// FAL_LORA_URL set, text→image already runs on the cheaper LoRA path and this isn't needed.
//
// Run:  node --env-file=.env.local scripts/upload-style-ref.mjs

import { fal } from "@fal-ai/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.FAL_KEY;
if (!KEY) {
  console.error("Set FAL_KEY");
  process.exit(1);
}
fal.config({ credentials: KEY });

const banner = join(ROOT, "public/brand/banner.png");
console.log("Uploading public/brand/banner.png …");
const url = await fal.storage.upload(new Blob([readFileSync(banner)], { type: "image/png" }));
console.log("\n✅ Style reference uploaded. Add this to .env.local:\n");
console.log(`FAL_STYLE_REF_URL=${url}`);
