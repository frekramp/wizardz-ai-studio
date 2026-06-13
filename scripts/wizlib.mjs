// Shared helpers for the v13 Wizardz LoRA dataset/training pipeline.
// Self-contained ESM so each pipeline script stays short.
// Run pipeline scripts with: node --env-file=.env.local scripts/<x>.mjs
import { fal } from "@fal-ai/client";
import OpenAI from "openai";
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = join(ROOT, "scripts/train-data/dataset-v13");

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("Set FAL_KEY in .env.local (run with: node --env-file=.env.local …)");
  process.exit(1);
}
fal.config({ credentials: FAL_KEY });
export { fal };

let _oai = null;
export function openai() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_oai) _oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _oai;
}

export const KONTEXT = process.env.FAL_EDIT_MODEL ?? "fal-ai/flux-pro/kontext";
export const FLUX_LORA = "fal-ai/flux-lora";

// The 8 canonical robe colors: [slug, rich prompt descriptor].
export const COLORS = [
  ["blue", "bright sky-blue"],
  ["purple", "vivid purple"],
  ["green", "emerald green"],
  ["yellow", "golden yellow"],
  ["red", "crimson red"],
  ["orange", "warm orange"],
  ["cyan", "teal cyan"],
  ["white", "clean white"],
];

// Style + identity language, kept identical across the pipeline.
export const VIBRANT_STYLE =
  "glossy cel-shaded cartoon style, bold clean black outlines, vibrant saturated colors, " +
  "rich atmospheric background, dramatic soft rim lighting, high detail";
export const KEEP_IDENTITY =
  "Keep the character's identity EXACTLY: a smooth pure-black faceless head whose only features are " +
  "two large glowing white oval eyes; the hood wrapping snugly around the face and framing it on every " +
  "side INCLUDING under the chin so NO neck or skin shows below the face; a simple one-piece A-line " +
  "hooded robe with a curled pointed hood tip and smooth sides (no cape, no flaps); clean smooth solid-black " +
  "rounded mitten gloves (three fingers + a thumb, oval stitch lines).";

// ---------- io ----------
export function ensureDir(p) { mkdirSync(p, { recursive: true }); return p; }
export async function fetchBuf(url) { return Buffer.from(await fetch(url).then((r) => r.arrayBuffer())); }
export async function saveUrl(path, url) { writeFileSync(path, await fetchBuf(url)); }
export function saveBuf(path, buf) { writeFileSync(path, buf); }

// Upload a local file path OR a Buffer to fal.storage → fal.media url.
export async function uploadFile(pathOrBuf, mime = "image/png") {
  const buf = Buffer.isBuffer(pathOrBuf) ? pathOrBuf : readFileSync(pathOrBuf);
  return fal.storage.upload(new Blob([buf], { type: mime }));
}

const clamp = (n) => Math.min(Math.max(Number(n) || 1, 1), 4);

// ---------- fal generation ----------
// Kontext image edit → array of result image URLs.
export async function kontext(imageUrl, prompt, { num = 1, guidance = 3.5, aspect } = {}) {
  const input = {
    image_url: imageUrl,
    prompt,
    guidance_scale: guidance,
    num_images: clamp(num),
    safety_tolerance: "5",
  };
  if (aspect) input.aspect_ratio = aspect;
  const res = await fal.subscribe(KONTEXT, { input, logs: false });
  return (res?.data?.images ?? []).map((i) => i?.url).filter(Boolean);
}

// flux-lora text→image → array of result image URLs.
export async function fluxLora(prompt, loraUrl, { scale = 1, num = 1, size = "square_hd" } = {}) {
  const res = await fal.subscribe(FLUX_LORA, {
    input: {
      prompt,
      loras: [{ path: loraUrl, scale }],
      image_size: size,
      num_images: clamp(num),
      enable_safety_checker: true,
    },
    logs: false,
  });
  return (res?.data?.images ?? []).map((i) => i?.url).filter(Boolean);
}

// ---------- design-enforcement Kontext passes ----------
const HAND_FIX_PROMPT =
  "Edit ONLY the character's hands/paws. Replace each hand with a clean simple solid-black rounded cartoon " +
  "MITTEN glove — exactly three plump rounded fingers plus a thumb (classic Mickey-Mouse-glove style), with " +
  "two small oval stitch lines on the back and a rounded cuff. NO long fingers, NO claws, NO human five-finger " +
  "hands, no extra digits, no melting or blobs. Keep everything else identical: same robe color, same eyes, " +
  "same hood, same pose, same objects the hands hold, same background, same art style.";
export async function handFix(url) {
  const out = await kontext(url, HAND_FIX_PROMPT, { num: 1, guidance: 4 });
  return out[0] ?? url;
}

// Close the hood / kill necks (mirrors lib/fal.ts ENFORCE_PROMPT).
const HOOD_FIX_PROMPT =
  "Edit this image, changing ONLY the hood and robe hem. HOOD: tuck the head deeper into the hood and make " +
  "the opening small and snug so hood fabric frames the dark face on ALL sides — above, left, right AND below " +
  "— the black face shows ONLY inside the small oval hood opening, fabric wrapping under the face. HEM: one " +
  "smooth simple rounded hem, remove any pointed flaps or trailing tips. Keep everything else identical: same " +
  "robe color, eyes, gloves, pose, background, art style.";
export async function hoodFix(url) {
  const out = await kontext(url, HOOD_FIX_PROMPT, { num: 1, guidance: 4 });
  return out[0] ?? url;
}

// ---------- openai vision gates ----------
export async function toDataUrl(ref, mime = "image/png") {
  let buf;
  if (Buffer.isBuffer(ref)) buf = ref;
  else if (/^https?:/.test(ref)) buf = await fetchBuf(ref);
  else buf = readFileSync(ref);
  return `data:${mime};base64,${buf.toString("base64")}`;
}
const asUrl = async (ref) => (/^https?:|^data:/.test(ref) ? ref : toDataUrl(ref));

async function askOnce(url, question, positives) {
  const o = openai();
  if (!o) return true; // fail open
  const r = await o.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: [{ type: "text", text: question }, { type: "image_url", image_url: { url } }] }],
  });
  const ans = (r.choices[0].message.content ?? "").trim().toUpperCase();
  return positives.some((p) => ans.startsWith(p));
}
async function majority(ref, question, positives) {
  try {
    const url = await asUrl(ref);
    const votes = await Promise.all([0, 1, 2].map(() => askOnce(url, question, positives)));
    return votes.filter(Boolean).length >= 2;
  } catch {
    return true; // fail open — never hard-block the pipeline on an API hiccup
  }
}

const Q_NECK =
  "Look at the wizard's hood opening. Does any dark face/neck color continue BELOW the hood opening toward " +
  "the chest (a visible neck)? Answer CLEAN if there is no neck, VIOLATION if there is. One word.";
const Q_HANDS =
  "Look at the wizard's hands. Are they clean simple solid-black cartoon MITTEN gloves with at most four stubby " +
  "digits (three fingers + a thumb) — NOT long splayed fingers, NOT claws, NOT human five-finger hands, not " +
  "melted/malformed/blobby? Answer KEEP if they are clean mittens, DROP if not. One word.";
const Q_ONMODEL =
  "Is this ONE single cartoon wizard with a faceless dark head showing exactly two glowing eyes, a simple " +
  "A-line hooded robe (no cape, no side-flaps), drawn in a vibrant glossy cel-shaded style? Answer KEEP or DROP. One word.";

export const gates = {
  neck: (ref) => majority(ref, Q_NECK, ["CLEAN"]),
  hands: (ref) => majority(ref, Q_HANDS, ["KEEP"]),
  onModel: (ref) => majority(ref, Q_ONMODEL, ["KEEP"]),
};

// Best-of-N: pick the single cleanest ref (url or local path). Returns the chosen ref.
export async function pickBest(refs) {
  const o = openai();
  if (refs.length <= 1 || !o) return refs[0];
  try {
    const urls = await Promise.all(refs.map(asUrl));
    const r = await o.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: [
        { type: "text", text:
          `${urls.length} variations of the same cartoon wizard follow, numbered 1 to ${urls.length}. Pick the ` +
          "SINGLE best: cleanest solid-black 4-finger MITTEN hands (no claws, no human hands), exactly two glowing " +
          "eyes, simple A-line robe, vibrant glossy cel-shaded, no floating blobs or artifacts. Reply with ONLY the number." },
        ...urls.map((url) => ({ type: "image_url", image_url: { url } })),
      ] }],
    });
    const m = (r.choices[0].message.content ?? "").match(/\d+/);
    const idx = m ? parseInt(m[0], 10) - 1 : 0;
    return refs[idx] ?? refs[0];
  } catch {
    return refs[0];
  }
}

// ---------- sharp helpers ----------
export async function toSquarePng(buf, size = 1024) {
  return sharp(buf).resize(size, size, { fit: "cover" }).png().toBuffer();
}

// Labeled contact sheet from local image paths. items: [{path,label}].
// `region` (fractions {l,t,w,h}) crops each tile first — used for hand/chin zoom sheets.
export async function contactSheet(items, outPath, { cols = 4, cell = 384, pad = 8, region } = {}) {
  const rows = Math.ceil(items.length / cols);
  const W = cols * cell + (cols + 1) * pad;
  const H = rows * cell + (rows + 1) * pad;
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tiles = await Promise.all(items.map(async (it, i) => {
    const raw = readFileSync(it.path);
    let pipe = sharp(raw);
    if (region) {
      const m = await sharp(raw).metadata();
      pipe = sharp(raw).extract({
        left: Math.round(region.l * m.width),
        top: Math.round(region.t * m.height),
        width: Math.round(region.w * m.width),
        height: Math.round(region.h * m.height),
      });
    }
    const png = await pipe.resize(cell, cell, { fit: "cover" }).png().toBuffer();
    const label = Buffer.from(
      `<svg width="${cell}" height="24"><rect width="100%" height="100%" fill="black" opacity="0.6"/>` +
      `<text x="6" y="17" font-size="14" fill="white" font-family="monospace">${esc(it.label)}</text></svg>`,
    );
    const labeled = await sharp(png).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
    const col = i % cols, row = Math.floor(i / cols);
    return { input: labeled, top: pad + row * (cell + pad), left: pad + col * (cell + pad) };
  }));
  await sharp({ create: { width: W, height: H, channels: 3, background: "#111111" } })
    .composite(tiles).png().toFile(outPath);
  return outPath;
}
