import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { cookies } from "next/headers";
import {
  FAL_ENABLED,
  MODELS,
  buildPrompt,
  buildRecreatePrompt,
  buildWizardScenePrompt,
  buildWizLoraPrompt,
  buildBannerPrompt,
  bannerRequest,
  masterRequest,
  kontextInput,
  loraInput,
  baseImageInput,
  isFalStorageUrl,
  extractOutput,
  vetVariants,
  hoodFix,
  handFix,
  zoomFill,
  captionImage,
  applyEyes,
  LORA_URL,
  MASTER_URL,
} from "@/lib/fal";
import {
  findMemePreset,
  sanitizeCaption,
  normalizeCaptionPosition,
  type CaptionPosition,
} from "@/lib/memes";
import { pickEyeTrait, normalizeEye, type EyeKey } from "@/lib/eyes";
import { OPENAI_ENABLED, openaiWizardImages, pickBest } from "@/lib/openai";
import { rateLimit } from "@/lib/ratelimit";
import { readSession, makeClaim } from "@/lib/session";
import { getUsage, tryReserve, refund, limitsFor, clientLimits, type GenMode } from "@/lib/quota";
import { imageUrlFor, traitTextFor, traitPhrasesFor, WIZARDZ_MAX_N } from "@/lib/wizardz";
import { clientIp, usageKey } from "@/lib/request";

export const runtime = "nodejs";

const MOTION: Record<string, string> = {
  Float: "gently floats and bobs in place, robe and cloak swaying softly",
  Bounce: "bounces up and down with playful, springy energy",
  Spin: "slowly spins and twirls around in place",
  Pulse: "pulses with glowing magical energy, its eyes flaring rhythmically",
};

// Text → image. PRIMARY engine: recolor/scene-swap the user-approved CANONICAL MASTER (the locked
// look — no necks, dress robe, glossy style). Fallbacks: trained LoRA, Kontext-on-banner, base.
function imageRequest(
  prompt: string,
  style: string | undefined,
  aspect: string | undefined,
  count: number,
  blankFace = false,
) {
  const master = masterRequest(prompt, aspect, count, blankFace);
  if (master) return master;
  if (LORA_URL) {
    return { model: MODELS.imageLora, input: loraInput(buildPrompt(prompt, style, true), aspect, count) };
  }
  const banner = bannerRequest(buildBannerPrompt(prompt), aspect, count);
  if (banner) return banner;
  return { model: MODELS.image, input: baseImageInput(buildPrompt(prompt, style, false), aspect, count) };
}

// Recreate an uploaded image with wizards. Omit aspect → kontext keeps the original's shape.
function recreateRequest(imageUrl: string, note: string, count: number) {
  return { model: MODELS.imageEdit, input: kontextInput(imageUrl, buildRecreatePrompt(note), undefined, count) };
}

// Reimagine a specific wizard — its traits (colour) drive a recolour of the canonical master.
// Primary: master recolour with the wizard's trait colour + scene. Fallbacks: LoRA, banner, art.
function wizRequest(
  n: number,
  scene: string,
  style: string | undefined,
  aspect: string | undefined,
  count: number,
  blankFace = false,
) {
  const master = masterRequest(`${traitPhrasesFor(n)} ${scene}`.trim(), aspect, count, blankFace);
  if (master) return master;
  if (LORA_URL) {
    return { model: MODELS.imageLora, input: loraInput(buildWizLoraPrompt(traitPhrasesFor(n), scene, style), aspect, count) };
  }
  const banner = bannerRequest(buildBannerPrompt(scene, traitPhrasesFor(n)), aspect, count);
  if (banner) return banner;
  const imageUrl = imageUrlFor(n);
  if (!imageUrl) return null;
  return {
    model: MODELS.imageEdit,
    input: kontextInput(imageUrl, buildWizardScenePrompt(scene, traitTextFor(n)), aspect, count),
  };
}

export async function POST(req: Request) {
  let body: {
    mode?: string;
    prompt?: string;
    style?: string;
    aspect?: string;
    motion?: string;
    imageUrl?: string; // recreate: the uploaded image (already on fal.storage via /api/upload)
    wiz?: number; // wiz: the collection number to star
    memeTag?: string; // meme: the chosen/typed preset tag (gm, wagmi, …)
    caption?: string; // meme: the text to overlay on the final image
    captionPos?: string; // meme: "top" | "bottom"
    eyes?: string; // eyes: explicit trait from the UI picker (overrides prompt parsing)
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const rawMode =
    body.mode === "gif" || body.mode === "recreate" || body.mode === "wiz" || body.mode === "meme"
      ? body.mode
      : "image";
  const prompt = (body.prompt ?? "").trim();
  const wizN = Number(body.wiz);

  // MEME mode: resolve the chosen/typed preset, then let any explicit field override it. The scene
  // feeds the same focused master engine as Image mode; the caption is overlaid AFTER generation.
  const memePreset =
    rawMode === "meme" ? findMemePreset(body.memeTag) ?? findMemePreset(prompt) : undefined;
  // If the whole prompt is just a known tag (e.g. "wagmi"), expand it to the preset's scene.
  const memeScene = (prompt && !findMemePreset(prompt) ? prompt : memePreset?.prompt ?? prompt).trim();
  const memeCaption = sanitizeCaption(body.caption ?? memePreset?.caption ?? "");
  const memePos: CaptionPosition = normalizeCaptionPosition(body.captionPos ?? memePreset?.position);

  // EYES trait: an explicit picker value wins; else parse the prompt (incl. the meme scene). null →
  // no eye keyword → keep the normal glowing eyes (no blank face, no overlay). Not for recreate/gif.
  const eyeText = rawMode === "meme" ? `${prompt} ${memeScene}` : prompt;
  const eyeKey: EyeKey | null =
    rawMode === "recreate" || rawMode === "gif"
      ? null
      : body.eyes
        ? normalizeEye(body.eyes)
        : pickEyeTrait(eyeText);

  // Per-mode input: recreate/wiz take an image/number as input, so the text prompt is optional.
  if (rawMode === "recreate") {
    // imageUrl must be one WE hosted on fal (via /api/upload) — never an arbitrary URL, which
    // would turn our fal key into a server-side fetcher of internal/arbitrary resources.
    if (!body.imageUrl || !isFalStorageUrl(body.imageUrl)) {
      return NextResponse.json({ error: "Upload an image to recreate." }, { status: 400 });
    }
  } else if (rawMode === "wiz") {
    if (WIZARDZ_MAX_N === 0) {
      return NextResponse.json({ error: "Wizard index isn't loaded yet." }, { status: 503 });
    }
    if (!Number.isInteger(wizN) || wizN < 1 || wizN > WIZARDZ_MAX_N) {
      return NextResponse.json(
        { error: `Enter a wizard number between 1 and ${WIZARDZ_MAX_N}.` },
        { status: 400 },
      );
    }
    if (!imageUrlFor(wizN)) {
      return NextResponse.json(
        { error: `Wizardz #${wizN} wasn't minted — try another.` },
        { status: 400 },
      );
    }
  } else if (rawMode === "meme") {
    if (memeScene.length < 3) {
      return NextResponse.json({ error: "Pick a meme or describe a scene." }, { status: 400 });
    }
  } else if (prompt.length < 3) {
    return NextResponse.json({ error: "Please enter a longer prompt." }, { status: 400 });
  }
  if (!FAL_ENABLED) {
    return NextResponse.json({ mock: true });
  }

  // Best-effort abuse guard (see lib/ratelimit.ts — production needs KV/DO + Turnstile).
  const ip = clientIp(req);
  if (!(await rateLimit(ip))) {
    return NextResponse.json({ error: "Too many spells — give it a minute." }, { status: 429 });
  }

  // Identity + daily usage quota (holder vs free). One tap = 1 credit; it over-generates
  // `variants` on-brand options for the holder to pick the best from.
  const session = readSession((await cookies()).get("wz_session")?.value);
  const holder = !!session?.holder;
  const idKey = usageKey(session, ip);
  const genMode: GenMode = rawMode === "gif" ? "gif" : "image";
  // Generate a few internally, then auto-pick the single cleanest (lib/openai pickBest) so the user
  // sees ONE polished image without dice-roll artifacts. GIFs stay at 1 (animation cost).
  const variants = genMode === "gif" ? 1 : 3;
  const limits = limitsFor(holder);
  // Reserve the credit before the fal call. Durable + cross-isolate via KV (lib/kv.ts); the KV
  // read-modify-write isn't perfectly atomic across simultaneous requests — acceptable for a daily
  // cap (a Durable Object is the upgrade for strict atomicity).
  if (!(await tryReserve(idKey, genMode, 1, genMode === "gif" ? limits.gif : limits.image))) {
    const msg = holder
      ? `You've used all ${limits.gif} GIFs for today — resets tomorrow.`
      : genMode === "gif"
        ? "That's your free GIF for today. Own a Wizardz to make 10 a day."
        : "You've used your 10 free generations for today. Own a Wizardz for unlimited.";
    return NextResponse.json({ error: msg, capped: true }, { status: 402 });
  }

  let refundOnError = 1; // refund the credit if we bail before a billed result is delivered
  try {
    // OpenAI engine (gpt-image-2): OFF by default — it's ~2min/gen, too slow for the tool. Kept
    // behind an opt-in flag (IMAGE_ENGINE=openai) for a possible future "HD" path. Default is the
    // fast fal Kontext-on-banner path below (~14s). Sync — returns data URLs directly, no poll.
    if (process.env.IMAGE_ENGINE === "openai" && OPENAI_ENABLED && (rawMode === "image" || rawMode === "wiz")) {
      const p =
        rawMode === "wiz" ? buildBannerPrompt(prompt, traitPhrasesFor(wizN)) : buildBannerPrompt(prompt);
      // gpt-image-2 is ~58s/image and this account serializes concurrent calls, so over-generating
      // costs wall-time. It's high-quality enough that fewer variants suffice: holders 2, free 1.
      const urls = await openaiWizardImages(p, holder ? 2 : 1, "medium");
      if (!urls.length) {
        await refund(idKey, "image", 1);
        return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
      }
      return NextResponse.json({
        urls,
        kind: "image",
        usage: await getUsage(idKey),
        limits: clientLimits(holder),
      });
    }
    if (genMode === "gif") {
      // Stage 1: generate the on-brand wizard image (LoRA), then animate it.
      const { model, input } = imageRequest(prompt, body.style, "1:1", 1);
      const img = await fal.subscribe(model, { input });
      const rawStill = (img.data as { images?: Array<{ url?: string }> })?.images?.[0]?.url;
      if (!rawStill) {
        await refund(idKey, "gif", 1);
        return NextResponse.json({ error: "Image step failed." }, { status: 502 });
      }
      // Neck-gate the still before animating — Kling preserves whatever's in the source frame, so
      // the still must pass the same hood-fix/judge as a normal image or the GIF inherits a neck.
      const [imageUrl] = await hoodFix([rawStill]);
      // Stage 1 produced a billed image — keep the GIF credit even if stage-2 fails (otherwise a
      // stage-2 error would hand out a free paid generation).
      refundOnError = 0;
      // Stage 2: image -> short looping video. Motion from the controls; duration locked to 5s
      // (10s Kling clips cost ~2x and drain the budget).
      const motion = MOTION[body.motion ?? "Float"] ?? MOTION.Float;
      const submitted = await fal.queue.submit(MODELS.gifFromImage, {
        input: {
          image_url: imageUrl,
          prompt: `the wizard ${motion} — smooth, high-quality, seamless looping animation`,
          duration: "5",
        },
      });
      return NextResponse.json({
        requestId: submitted.request_id,
        model: MODELS.gifFromImage,
        claim: makeClaim(submitted.request_id, idKey),
        usage: await getUsage(idKey),
        limits: clientLimits(holder),
      });
    }

    // Image-family modes (image | recreate | wiz) — all consume image credits.
    const built =
      rawMode === "recreate"
        ? recreateRequest(body.imageUrl as string, prompt, variants)
        : rawMode === "wiz"
          ? wizRequest(wizN, prompt, body.style, body.aspect, variants, !!eyeKey)
          : rawMode === "meme"
            ? imageRequest(memeScene, body.style, body.aspect, variants, !!eyeKey)
            : imageRequest(prompt, body.style, body.aspect, variants, !!eyeKey);
    if (!built) {
      await refund(idKey, "image", 1);
      return NextResponse.json({ error: "Couldn't resolve that wizard." }, { status: 400 });
    }

    // Master recolor path runs SYNCHRONOUSLY so we can apply the neck + hand fix AT THE SOURCE: the
    // loosened prompt-following can drift on action poses, so best-of-N → conditional neck-fix
    // (hoodFix) → conditional hand-fix (handFix). Recreate keeps the async queue path further down.
    const isMaster =
      !!MASTER_URL &&
      built.model === MODELS.imageEdit &&
      (built.input as { image_url?: string }).image_url === MASTER_URL;
    if (isMaster && rawMode !== "recreate") {
      const res = await fal.subscribe(built.model, { input: built.input });
      const out = extractOutput(res.data);
      if (!out?.urls.length) {
        await refund(idKey, "image", 1);
        return NextResponse.json({ error: "Generation failed." }, { status: 502 });
      }
      const vetted = await vetVariants(out.urls);
      const picked = vetted.length > 1 ? [await pickBest(vetted)] : vetted; // best-of-N → one image
      const necked = await hoodFix(picked); // neck-fix at the source (conditional)
      let urls = await handFix(necked); // hand-fix at the source (conditional)
      // EYES trait: overlay the chosen eye art onto the blank face (the model drew none).
      if (eyeKey) {
        urls = await Promise.all(urls.map((u) => applyEyes(u, eyeKey)));
      }
      // Meme mode: bake the caption on as a real text layer (the model can't spell it reliably).
      if (rawMode === "meme" && memeCaption) {
        urls = await Promise.all(urls.map((u) => captionImage(u, memeCaption, memePos)));
      }
      return NextResponse.json({
        urls,
        kind: "image",
        usage: await getUsage(idKey),
        limits: clientLimits(holder),
      });
    }

    // LoRA generations run SYNCHRONOUSLY so we can apply the guaranteed no-neck hood-fix pass
    // (the Kontext edit that fixed 30/30 dataset images) to every image before the user sees it.
    if (built.model === MODELS.imageLora && rawMode !== "recreate") {
      const res = await fal.subscribe(built.model, { input: built.input as { prompt: string } });
      const out = extractOutput(res.data);
      if (!out?.urls.length) {
        await refund(idKey, "image", 1);
        return NextResponse.json({ error: "Generation failed." }, { status: 502 });
      }
      const fixed = await hoodFix(out.urls);
      const vetted = await vetVariants(fixed);
      const picked = vetted.length > 1 ? [await pickBest(vetted)] : vetted; // best-of-N → one image
      let urls = await zoomFill(picked); // free center zoom so the wizard fills the frame
      if (eyeKey) {
        urls = await Promise.all(urls.map((u) => applyEyes(u, eyeKey)));
      }
      if (rawMode === "meme" && memeCaption) {
        urls = await Promise.all(urls.map((u) => captionImage(u, memeCaption, memePos)));
      }
      return NextResponse.json({
        urls,
        kind: "image",
        usage: await getUsage(idKey),
        limits: clientLimits(holder),
      });
    }

    const submitted = await fal.queue.submit(built.model, { input: built.input });
    return NextResponse.json({
      requestId: submitted.request_id,
      model: built.model,
      claim: makeClaim(submitted.request_id, idKey),
      usage: await getUsage(idKey),
      limits: clientLimits(holder),
    });
  } catch (e) {
    if (refundOnError > 0) await refund(idKey, genMode, refundOnError); // fal failed → give credits back
    console.error("generate failed:", e);
    return NextResponse.json({ error: "Failed to start generation." }, { status: 502 });
  }
}
