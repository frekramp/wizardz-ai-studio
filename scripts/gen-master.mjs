// Generate canonical-master candidates by combining THREE references through a multi-image edit
// model: a POSE/silhouette ref (image 1), a STYLE+color ref (image 2), and a GLOVE sheet (image 3).
// Reusable for angle masters later — just swap --pose (e.g. files/2-three-quarter.png).
//
// Model: defaults to Kontext Max multi (takes an image_urls array + guidance_scale). Override with
// --model or FAL_EDIT_MULTI_MODEL, e.g. `--model fal-ai/nano-banana/edit` (Gemini) if you prefer.
//
// Run:
//   node --env-file=.env.local scripts/gen-master.mjs \
//     --pose <path> --style <path> --glove <path> --n 12 --out scripts/out/cand
//
// Saves <out>/cand-01..NN.png (one image per candidate, seed varied each time).

import { fal } from "@fal-ai/client";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, extname, join } from "node:path";

// ---- args ----
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const POSE = arg("pose", "");
const STYLE = arg("style", "");
const GLOVE = arg("glove", "");
const N = Math.max(1, parseInt(arg("n", "12"), 10) || 12);
const OUT = resolve(process.cwd(), arg("out", "scripts/out/cand"));
const MODEL = arg("model", process.env.FAL_EDIT_MULTI_MODEL || "fal-ai/flux-pro/kontext/max/multi");
const ASPECT = arg("aspect", "1:1");
const GUIDANCE = Number(arg("guidance", "3.5"));

const KEY = process.env.FAL_KEY;
if (!KEY) { console.error("Set FAL_KEY in env (run with --env-file=.env.local)"); process.exit(1); }
fal.config({ credentials: KEY });

for (const [flag, p] of [["--pose", POSE], ["--style", STYLE], ["--glove", GLOVE]]) {
  if (!p) { console.error(`Missing ${flag} <path>`); process.exit(1); }
  if (!existsSync(resolve(process.cwd(), p))) { console.error(`File not found (${flag}): ${p}`); process.exit(1); }
}
mkdirSync(OUT, { recursive: true });

const mimeOf = (f) => (extname(f).toLowerCase() === ".png" ? "image/png" : "image/jpeg");
const up = (p) => {
  const f = resolve(process.cwd(), p);
  return fal.storage.upload(new Blob([readFileSync(f)], { type: mimeOf(f) }));
};

const PROMPT =
  "Use the FIRST image for the pose and silhouette, and the SECOND image for the exact art " +
  "style and blue color. Full-body cartoon wizard, head to feet, centered. Glossy cel-shaded, " +
  "bright blue hood and robe, thick clean black outline, smooth flat shading with soft glossy " +
  "highlights. Smooth matte-black face inside the hood with two large glowing white oval eyes " +
  "and NO mouth or other features. Standing upright facing forward, tall pointed wizard hood " +
  "with a curled tip, straight A-line floor-length robe, both arms relaxed straight down at the " +
  "sides, hands as smooth rounded solid-black gloves with a cuff (matching the third image), " +
  "resting empty. Hood collar sits directly on the shoulders — NO neck, no visible skin. No " +
  "orb, no objects, no staff, no magic, no text, no watermark. Plain dark navy background.";
const NEGATIVE =
  "neck, long neck, mouth, teeth, nose, raised arms, outstretched arms, pointing, separated " +
  "splayed fingers, claws, holding object, orb, cup, staff, magic effect, text, watermark, logo, " +
  "extra limbs, two heads, deformed hands, cropped, cut off, blurry, photorealistic, sketch, lineart";

// Kontext/FLUX take guidance_scale + seed + aspect_ratio; Gemini-style edit models take a minimal
// shape, so only attach the extra knobs for the FLUX family.
const isFlux = /kontext|flux/i.test(MODEL);
const buildInput = (image_urls, seed) => {
  const base = { prompt: `${PROMPT}\n\nDo NOT include any of: ${NEGATIVE}.`, image_urls, num_images: 1 };
  return isFlux
    ? { ...base, guidance_scale: GUIDANCE, aspect_ratio: ASPECT, seed, safety_tolerance: "5", output_format: "png" }
    : { ...base, aspect_ratio: ASPECT, output_format: "png" };
};

console.log(`Uploading 3 refs …`);
const [poseUrl, styleUrl, gloveUrl] = await Promise.all([up(POSE), up(STYLE), up(GLOVE)]);
const image_urls = [poseUrl, styleUrl, gloveUrl];
console.log(`model:  ${MODEL}\naspect: ${ASPECT}  guidance: ${isFlux ? GUIDANCE : "n/a"}\n→ ${N} candidates into ${OUT}\n`);

const pad = (i) => String(i).padStart(2, "0");
let ok = 0;
for (let i = 1; i <= N; i++) {
  const seed = 1000 + i * 1234; // vary the seed each candidate
  try {
    const r = await fal.subscribe(MODEL, { input: buildInput(image_urls, seed), logs: false });
    const url = r?.data?.images?.[0]?.url || r?.data?.image?.url;
    if (!url) throw new Error("no image url in response");
    const buf = Buffer.from(await fetch(url).then((x) => x.arrayBuffer()));
    writeFileSync(join(OUT, `cand-${pad(i)}.png`), buf);
    ok++;
    console.log(`  ✓ cand-${pad(i)}.png  (seed ${seed})`);
  } catch (e) {
    console.log(`  ✗ cand-${pad(i)}  — ${e.message ?? e}`);
  }
}
console.log(`\ndone: ${ok}/${N} saved → ${OUT}`);
if (ok === 0) console.log(`(0 saved — if every call errored on the model id, retry with --model fal-ai/nano-banana/edit)`);
