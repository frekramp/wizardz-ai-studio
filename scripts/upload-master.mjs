// Upload the canonical master to fal.storage once → use the printed URL as FAL_MASTER_URL.
// FAL_MASTER_URL drives the Kontext recolor/scene-swap engine (lib/fal.ts masterRequest): the
// studio restyles this one verified-clean master each generation instead of dice-rolling a fresh
// figure. Re-run whenever the master image changes, then update the env var (.env.local + Vercel).
//
// Run:  node --env-file=.env.local scripts/upload-master.mjs [path/to/master]
//   default: public/brand/canonical/master-neutral.png

import { fal } from "@fal-ai/client";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.FAL_KEY;
if (!KEY) {
  console.error("Set FAL_KEY");
  process.exit(1);
}
fal.config({ credentials: KEY });

const file = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(ROOT, "public/brand/canonical/master-neutral.png");
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const mime = extname(file).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
console.log(`Uploading ${file} (${mime}) …`);
const url = await fal.storage.upload(new Blob([readFileSync(file)], { type: mime }));
console.log("\n✅ Master uploaded. Add this to .env.local + Vercel:\n");
console.log(`FAL_MASTER_URL=${url}`);
