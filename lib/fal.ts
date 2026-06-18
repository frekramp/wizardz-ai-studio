import { fal } from "@fal-ai/client";

// Configure the singleton once (server-side only — this module is imported by route handlers).
if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

export const FAL_ENABLED = !!process.env.FAL_KEY;

// Swap these via env without code changes. Defaults: cheap FLUX for images, LTX for short video/GIF.
export const MODELS = {
  // Cheap base for pre-LoRA testing (~$0.003/img). The trained LoRA below is what delivers your style.
  image: process.env.FAL_IMAGE_MODEL ?? "fal-ai/flux/schnell",
  imageLora: "fal-ai/flux-lora", // FLUX.1 dev + your LoRA — great quality, ~$0.02-0.03/img
  // Animate the on-brand LoRA image — Kling = super quality (env-overridable).
  gifFromImage: process.env.FAL_GIF_MODEL ?? "fal-ai/kling-video/v2.1/standard/image-to-video",
  // Image-conditioned editing — the on-brand engine (Kontext anchored to the banner) + "recreate
  // this meme" + "my wiz #". Base kontext (~$0.04) keeps the 4-variant over-generate sane; the
  // /max tier is ~2x for marginal gain when you're picking the best of several anyway.
  imageEdit: process.env.FAL_EDIT_MODEL ?? "fal-ai/flux-pro/kontext",
} as const;

// Once a Wizardz style LoRA is trained, set FAL_LORA_URL to its weights file URL.
export const LORA_URL = process.env.FAL_LORA_URL || null;
export const LORA_SCALE = Number(process.env.FAL_LORA_SCALE ?? "1");

// banner.png pre-uploaded to fal.storage (scripts/upload-style-ref.mjs). When set, this is the
// PRIMARY engine: every generation is anchored to the banner key art via Kontext (bannerRequest),
// which locks the on-brand look. Unset it to fall back to the LoRA / base path.
export const STYLE_REF_URL = process.env.FAL_STYLE_REF_URL || null;

// The user-approved CANONICAL MASTER on fal.storage (public/brand/canonical/master-blue.jpg).
// When set, it's the primary engine — every generation recolors/scene-swaps this exact image, so
// output is locked to the approved look (hood-framed face, dress robe, glossy style; no necks).
export const MASTER_URL = process.env.FAL_MASTER_URL || null;

const STYLE_HINT: Record<string, string> = {
  Classic: "clean cartoon line art",
  Cosmic: "cosmic galaxy nebula background",
  Pixel: "pixel-art, 8-bit",
  Inked: "bold inked comic style",
};

// MANDATORY enhanced-prompt blocks (user-locked). Plain prompts drop the eyes and flatten
// detail even on the trained LoRA — every generation must carry all of these. Do not trim.
// The no-neck geometry (user-locked, from approved examples): the dark face shows ONLY inside a
// snug oval hood opening — hood fabric frames it on all sides INCLUDING below, like a face
// peeking out of a cozy hood. Positive phrasing on purpose; the v11 LoRA is trained to match.
export const WIZ_EYES =
  "its dark face with two large glowing white oval eyes peeking out from a snug oval hood " +
  "opening, the hood's fabric framing the face on every side including underneath it, black " +
  "visible only inside the hood opening, the face completely smooth and featureless with NO " +
  "mouth, no nose and no other facial features at all — only the two glowing eyes";
export const WIZ_ROBE =
  "one simple plain hooded robe with a curled pointed hood tip, falling straight down as a single " +
  "smooth one-piece A-line, wide sleeves, completely smooth sides — no cape, no side slits, no " +
  "wing-like side flaps, no extra fabric panels flaring out at the left or right";
export const WIZ_HANDS = "neat black rounded mitten gloves, smooth and clean";
export const WIZ_STYLE =
  "glossy cel-shaded cartoon, bold clean outlines, vibrant saturated colors, rich detailed atmospheric background, soft cinematic lighting";

export function buildPrompt(prompt: string, style?: string | null, useLora = false): string {
  const extra = style && STYLE_HINT[style] ? `, ${STYLE_HINT[style]}` : "";
  if (useLora) {
    return `wzrdz, a single Wizardz wizard, ${prompt.trim()}, the wizard large and prominent in the frame with a full visible body and minimal empty background, ${WIZ_EYES}, ${WIZ_ROBE}, ${WIZ_HANDS}, ${WIZ_STYLE}${extra}`;
  }
  return `${prompt.trim()}. Wizardz character art: ${WIZ_EYES}, ${WIZ_ROBE}, ${WIZ_HANDS}; ${WIZ_STYLE}${extra}`;
}

// Replace the people in an uploaded image with Wizardz wizards, keeping its composition.
export function buildRecreatePrompt(note?: string | null): string {
  const extra = note && note.trim() ? ` ${note.trim()}.` : "";
  return (
    "Redraw this exact image in a glossy cel-shaded cartoon style. Replace every person, human, and " +
    "character with a Wizardz wizard: a smooth pure-black faceless head whose ONLY features are two large " +
    "glowing almond-shaped eyes (no nose, no mouth, no other facial features), wearing a flowing hooded cloak " +
    "with a tall curled pointed hood (NOT a pointed witch hat), and neat black cartoon gloves. Keep the original " +
    "composition, poses, gestures, framing, number of characters, props, on-image text and background exactly. " +
    `Bold clean black outlines, vibrant saturated colors, smooth glossy cel shading, dramatic rim lighting.${extra}`
  );
}

// Reimagine a specific wizard in the trained 2D Wizardz style FROM ITS TRAITS (not its pixel art).
// Lean LoRA-trigger prompt — the LoRA already encodes the character + glossy cel-shaded look.
export function buildWizLoraPrompt(
  traitPhrases?: string | null,
  scene?: string | null,
  style?: string | null,
): string {
  const styleHint = style && STYLE_HINT[style] ? `, ${STYLE_HINT[style]}` : "";
  const s = scene && scene.trim();
  // Lead with the subject + action so the scene/props aren't drowned out by the trait and
  // character tokens — the LoRA has a strong single-portrait prior, so we also explicitly
  // ask for a full-body action shot to pull props (surfboard, staff, etc.) into frame.
  const subject = s
    ? `wzrdz, a single Wizardz wizard ${s}, full-body dynamic action shot, the wizard large and prominent in the frame with minimal empty background`
    : "wzrdz, a single Wizardz wizard, large and prominent in the frame with a full visible body";
  const traits = traitPhrases && traitPhrases.trim() ? `, ${traitPhrases.trim()}` : "";
  return `${subject}${traits}, ${WIZ_EYES}, ${WIZ_ROBE}, ${WIZ_HANDS}, ${WIZ_STYLE}${styleHint}`;
}

// Put a SPECIFIC wizard (its on-chain art is the reference image) into a new scene.
// Kept as the no-LoRA fallback for wiz mode (kontext on the inscription image).
export function buildWizardScenePrompt(scene?: string | null, traitText?: string | null): string {
  const s = scene && scene.trim() ? scene.trim() : "a striking hero portrait on a simple dark cosmic background";
  const traits = traitText && traitText.trim() ? ` Preserve its exact traits: ${traitText.trim()}.` : "";
  return (
    "Keep THIS exact Wizardz wizard — the same cloak color, hood shape, glowing eyes, gloves and " +
    `every detail of its design.${traits} Place it in a new scene: ${s}. Glossy cel-shaded Wizardz ` +
    "cartoon art style, bold clean outlines, vibrant saturated colors, dramatic rim lighting."
  );
}

// Shared count clamp (1–4 images per request) + the flux-lora image_size enum.
export function clampCount(count: number): number {
  return Math.min(Math.max(Number(count) || 1, 1), 4);
}

const IMAGE_SIZE: Record<string, string> = {
  "1:1": "square_hd",
  "4:5": "portrait_4_3",
  "16:9": "landscape_16_9",
};
export function imageSizeFor(aspect?: string): string {
  return IMAGE_SIZE[aspect ?? "1:1"] ?? "square_hd";
}

// Base FLUX text→image input; loraInput layers the trained Wizardz LoRA on top.
export function baseImageInput(
  prompt: string,
  aspect: string | undefined,
  count: number,
): Record<string, unknown> {
  return {
    prompt,
    image_size: imageSizeFor(aspect),
    num_images: clampCount(count),
    enable_safety_checker: true,
  };
}
export function loraInput(
  prompt: string,
  aspect: string | undefined,
  count: number,
): Record<string, unknown> {
  return { ...baseImageInput(prompt, aspect, count), loras: [{ path: LORA_URL, scale: LORA_SCALE }] };
}

// Only allow recreate/edit to condition on images WE hosted on fal.storage — which lands on
// the fal CDN (*.fal.media). NOT *.fal.run (the open serverless namespace anyone can deploy to)
// and never an arbitrary host (else our fal key becomes a fetcher of attacker/internal URLs).
export function isFalStorageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)fal\.media$/i.test(u.hostname);
  } catch {
    return false;
  }
}

// Anchor a generation to the banner key art (Kontext on STYLE_REF_URL) — the on-brand engine.
// `subject` = the user prompt / scene; `traitPhrases` = a specific wizard's traits (wiz mode).
export function buildBannerPrompt(subject?: string | null, traitPhrases?: string | null): string {
  const s = subject && subject.trim() ? subject.trim() : "a single Wizardz wizard";
  const traits = traitPhrases && traitPhrases.trim() ? ` with ${traitPhrases.trim()}` : "";
  return (
    "In the EXACT glossy painterly Wizardz key-art style of this reference image, draw ONE single " +
    `Wizardz wizard${traits}: ${s}. Faceless smooth dark head with two glowing almond eyes, a flowing ` +
    "hooded robe with a tall pointed hood that curls over at the tip and long draped sleeves, neat black " +
    "cartoon gloves with well-formed fingers, NO cape. Full body, centered, dark cosmic background, " +
    "vibrant saturated colors, bold clean outlines."
  );
}

// flux-pro/kontext speaks aspect_ratio strings (not the image_size enum flux-lora uses).
const KONTEXT_ASPECT: Record<string, string> = {
  "1:1": "1:1",
  "4:5": "3:4", // kontext has no 4:5 — 3:4 is the closest portrait
  "16:9": "16:9",
};

// Build a flux-pro/kontext request body. Omit `aspect` to preserve the reference image's
// own shape (what we want when recreating a meme).
export function kontextInput(
  imageUrl: string,
  prompt: string,
  aspect: string | undefined,
  count: number,
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    image_url: imageUrl,
    prompt,
    guidance_scale: 3.5,
    num_images: clampCount(count),
    // permissive: we're turning photos of people into cartoon wizards, not the people themselves
    safety_tolerance: "5",
  };
  if (aspect && KONTEXT_ASPECT[aspect]) input.aspect_ratio = KONTEXT_ASPECT[aspect];
  return input;
}

// Kontext conditioned on the banner key art. Returns null when no banner anchor is configured.
// NOTE: fallback only — the banner's characters have visible necks/varied robes, so this path
// can't honor the locked design. The canonical master is the primary engine.
export function bannerRequest(prompt: string, aspect: string | undefined, count: number) {
  if (!STYLE_REF_URL) return null;
  return { model: MODELS.imageEdit, input: kontextInput(STYLE_REF_URL, prompt, aspect, count) };
}

// PRIMARY engine: recolor + scene-swap the user-approved canonical master via Kontext. Output is
// locked to the exact approved look — only the robe colour and the background change, so the
// flaky neck/robe-drift of fresh generation can't appear (this is the method the user signed off).
// Returns null if no master is configured (caller falls back to the LoRA / banner path).
export function masterRequest(prompt: string, aspect: string | undefined, count: number) {
  if (!MASTER_URL) return null;
  const req = prompt.trim() || "the same wizard, simple plain background";
  // Identity HARD-LOCKED (no-neck hood geometry + robe/eyes/mitts/style); pose, props, scene FREE so
  // the request actually renders. The base is the NEUTRAL empty-handed master (no orb to cling to),
  // so even descriptive prompts ("potion-brewing wizard") render the described content — verified on
  // potion→cauldron, staff→staff, surfboard→surfing, GM→coffee, all neck-clean.
  const p =
    "Transform this exact wizard into a brand-new illustration that VIVIDLY depicts the request below. " +
    "Actually render the described subject, action, scene, clothing and props — not just a recolour. " +
    "KEEP IDENTICAL (the character's identity): the dark featureless face with two large glowing white " +
    "oval eyes; the hood wrapping snugly around the face and framing it on EVERY side INCLUDING under " +
    "the chin so NO neck, throat or skin shows below the face; the smooth black mitten gloves; the " +
    "simple one-piece A-line hooded-robe SHAPE with a curled pointed hood tip and smooth sides (no " +
    "cape, no flaps); and the glossy cel-shaded cartoon style with bold clean outlines and soft " +
    "lighting. CHANGE FREELY to match the request: the pose and body position, the entire background " +
    "and scene, any props or objects the hands hold or use, and the robe's colour and pattern. The " +
    `requested subject and setting must be obvious at a glance. Request: ${req}`;
  return { model: MODELS.imageEdit, input: kontextInput(MASTER_URL, p, aspect, count) };
}

// DESIGN ENFORCEMENT — the guarantee layer on every generated image, closing the two
// user-banned flaws in one edit, then VERIFYING with a vision model and retrying once.
// 1) neck: the face may be visible ONLY inside a snug hood opening (fabric under the face);
// 2) hem: the robe ends in one smooth simple hem — no pointed extra fabric pieces at the corners.
const ENFORCE_PROMPT =
  "Edit this image, changing ONLY the character's hood and robe hem. " +
  "HOOD: tuck the head deeper into the hood and make the hood's opening small and snug, so hood fabric " +
  "completely frames the dark face on all sides — above, left, right, AND below it; the black of the face " +
  "is visible ONLY inside the hood's small oval opening, with fabric wrapping under the face. " +
  "HEM: simplify the bottom of the robe into ONE smooth simple rounded hem resting on the ground — remove " +
  "any pointed flaps, trailing tips, or extra fabric pieces sticking out at the bottom left or right. " +
  "Keep everything else exactly the same: same robe color, same eyes, same gloves, same pose, same " +
  "background, same art style.";

// Deterministic neck detector (VLM judges proved unreliable — moondream ignores questions).
// Finds the glowing eyes, then measures how far black continues straight down from eye level
// before hitting fabric, normalized by eye distance. Calibrated on user-approved vs user-flagged
// images: clean ≤ ~1.1, neck ≥ ~1.2 → threshold 1.15. Returns null when eyes can't be found.
const CHIN_LIMIT = 1.15;
export async function chinRatio(url: string): Promise<number | null> {
  try {
    const ab = (await fetch(url).then((r) => r.arrayBuffer())) as ArrayBuffer;
    const buf = new Uint8Array(ab);
    if (!(buf[0] === 0xff && buf[1] === 0xd8)) return null; // not a JPEG
    const { decode } = await import("jpeg-js");
    const img = decode(buf, { maxMemoryUsageInMB: 1024, formatAsRGBA: true });
    const { width: W, height: H, data } = img;
    const px = (x: number, y: number) => {
      const i = (y * W + x) * 4;
      return [data[i], data[i + 1], data[i + 2]] as const;
    };
    // bright "eye" pixels in the upper band
    const pts: Array<[number, number]> = [];
    const x0 = Math.floor(W * 0.12), x1 = Math.floor(W * 0.88);
    const y0 = Math.floor(H * 0.06), y1 = Math.floor(H * 0.62);
    const step = Math.max(1, Math.floor(W / 256));
    for (let y = y0; y < y1; y += step)
      for (let x = x0; x < x1; x += step) {
        const [r, g, b] = px(x, y);
        if (Math.min(r, g, b) > 220) pts.push([x, y]);
      }
    if (pts.length < 6) return null;
    const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
    const mx = xs[Math.floor(xs.length / 2)];
    const L = pts.filter((p) => p[0] < mx), R = pts.filter((p) => p[0] >= mx);
    if (!L.length || !R.length) return null;
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const lx = mean(L.map((p) => p[0])), rx = mean(R.map((p) => p[0]));
    const eyeY = Math.round(mean(pts.map((p) => p[1])));
    const eyeDist = Math.max(rx - lx, W * 0.03);
    const cx = Math.round((lx + rx) / 2), half = Math.max(2, Math.round(eyeDist * 0.35));
    const runs: number[] = [];
    for (let x = cx - half; x <= cx + half; x += Math.max(1, Math.floor(step * 2))) {
      let y = eyeY, run = 0;
      while (y < H) {
        const [r, g, b] = px(Math.min(Math.max(x, 0), W - 1), y);
        if (Math.max(r, g, b) >= 70) break;
        run++; y++;
      }
      runs.push(run);
    }
    runs.sort((a, b) => a - b);
    return runs[Math.floor(runs.length / 2)] / eyeDist;
  } catch {
    return null; // detector unavailable → don't block delivery
  }
}

async function enforceOnce(url: string): Promise<string> {
  const r = await fal.subscribe(MODELS.imageEdit, {
    input: { image_url: url, prompt: ENFORCE_PROMPT, num_images: 1, guidance_scale: 4, safety_tolerance: "5" },
    logs: false,
  });
  return (r.data as { images?: Array<{ url?: string }> })?.images?.[0]?.url || url;
}

// The delivery gate: judge (majority-vote GPT vision) → enforce-edit on failures → re-judge →
// drop variants that still fail. Pixel chinRatio is kept as a cheap pre-filter; the judge is
// the arbiter. If everything fails, the best pixel-scoring variant ships (never zero results).
export async function hoodFix(urls: string[]): Promise<string[]> {
  const { neckClean } = await import("./openai");
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        let current = url;
        // cheap pixel pre-pass: obviously-long chins get an edit before spending judge votes
        const pre = await chinRatio(current);
        if (pre !== null && pre > CHIN_LIMIT) current = await enforceOnce(current);
        let ok = await neckClean(current);
        if (!ok) {
          current = await enforceOnce(current);
          ok = await neckClean(current);
        }
        return { url: current, ok, ratio: (await chinRatio(current)) ?? 0 };
      } catch {
        return { url, ok: false, ratio: 99 };
      }
    }),
  );
  const clean = results.filter((r) => r.ok);
  if (clean.length) return clean.map((r) => r.url);
  results.sort((a, b) => a.ratio - b.ratio);
  return [results[0].url];
}

type FalData = {
  images?: Array<{ url?: string }>;
  image?: { url?: string };
  video?: { url?: string };
};

// Quality gate over the over-generated variants: drop gross-failure tiles (the black/blank glitch)
// so a holder never sees one. A solid-black image compresses to a tiny JPEG (~16KB) vs ~170KB+ for
// a real wizard, so a content-length check catches them deterministically and free — no model call.
// Unknown size (0) or any error → keep the variant; never return an empty list.
const MIN_GOOD_BYTES = 50_000;
export async function vetVariants(urls: string[]): Promise<string[]> {
  if (urls.length < 2) return urls;
  const sized = await Promise.all(
    urls.map(async (url) => {
      try {
        const r = await fetch(url, { method: "HEAD" });
        const len = Number(r.headers.get("content-length") ?? "0");
        return { url, ok: len === 0 || len >= MIN_GOOD_BYTES };
      } catch {
        return { url, ok: true }; // can't size it → keep it
      }
    }),
  );
  const good = sized.filter((s) => s.ok).map((s) => s.url);
  return good.length ? good : urls;
}

// Gentle center zoom-crop so the (always-centered) wizard fills more of the frame — fixes the
// "character too small / too much empty background" look without any extra generation. FREE: just
// crops to WIZ_ZOOM of each side, re-squares to 1024, and re-hosts on fal.storage. Fail-safe — any
// error (incl. sharp unavailable) returns the original URL so delivery never breaks. Tune via the
// WIZ_ZOOM env (smaller = more zoom; 0.85 ≈ 18% larger subject; 1 = off).
const ZOOM_FRAC = Number(process.env.WIZ_ZOOM ?? "1");
export async function zoomFill(urls: string[]): Promise<string[]> {
  if (!(ZOOM_FRAC > 0 && ZOOM_FRAC < 0.999)) return urls;
  try {
    const sharp = (await import("sharp")).default;
    return await Promise.all(
      urls.map(async (url) => {
        try {
          const ab = (await fetch(url).then((r) => r.arrayBuffer())) as ArrayBuffer;
          const input = Buffer.from(new Uint8Array(ab));
          const meta = await sharp(input).metadata();
          const W = meta.width ?? 1024;
          const H = meta.height ?? 1024;
          const cw = Math.round(W * ZOOM_FRAC);
          const ch = Math.round(H * ZOOM_FRAC);
          const out = await sharp(input)
            .extract({ left: Math.round((W - cw) / 2), top: Math.round((H - ch) / 2), width: cw, height: ch })
            .resize(1024, 1024)
            .png()
            .toBuffer();
          return await fal.storage.upload(new Blob([new Uint8Array(out)], { type: "image/png" }));
        } catch {
          return url; // fail-safe per image
        }
      }),
    );
  } catch {
    return urls; // fail-safe (e.g. sharp unavailable) — never block delivery
  }
}

export function extractOutput(
  data: unknown,
): { urls: string[]; kind: "image" | "video" } | null {
  const d = (data ?? {}) as FalData;
  if (d.video?.url) return { urls: [d.video.url], kind: "video" };
  const imgs = (d.images ?? []).map((i) => i.url).filter((u): u is string => !!u);
  if (imgs.length) return { urls: imgs, kind: "image" };
  if (d.image?.url) return { urls: [d.image.url], kind: "image" };
  return null;
}
