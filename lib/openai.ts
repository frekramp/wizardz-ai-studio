import OpenAI from "openai";
import { STYLE_REF_URL } from "./fal";

// gpt-image-2 engine. Anchored to the banner key art via the edits endpoint, so output stays
// on-brand. Returns DATA URLs (no external host needed → works with fal down). For production,
// swap the data-URL packaging for Cloudflare R2 so history/share get durable URLs.
//
// Cost note (measured): medium ~$0.06/image, high ~$0.22 for ~identical quality on this flat
// cel-shaded style — so we use `medium`. Verified org required for gpt-image-2 access.

export const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
export type ImgQuality = "low" | "medium" | "high";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  _client = new OpenAI({ apiKey: key });
  return _client;
}

// The banner is a CDN read (fal.media), not a fal API call, so it works even when the fal API is
// blocked. Cached in-module so we fetch it once per process.
let _banner: ArrayBuffer | null = null;
async function bannerBytes(): Promise<ArrayBuffer> {
  if (_banner) return _banner;
  if (!STYLE_REF_URL) throw new Error("FAL_STYLE_REF_URL (banner anchor) is not set.");
  const res = await fetch(STYLE_REF_URL);
  if (!res.ok) throw new Error(`Banner fetch failed: ${res.status}`);
  _banner = await res.arrayBuffer();
  return _banner;
}

// Neck judge (the production quality gate). gpt-4.1-mini vision, majority-of-3 votes — fast
// (~1s/call) AND accurate on the user's labeled set, where gpt-4o-mini missed necks and gpt-5-mini
// was far too slow (reasoning). Majority smooths borderline flakiness. Fails open (true) if the API
// is unavailable so generation never hard-blocks.
const JUDGE_Q =
  "Find the lowest point of the hood opening (where hood fabric crosses in front). Does any dark " +
  "face/body color continue BELOW that line toward the chest? If yes answer VIOLATION, if no answer " +
  "CLEAN. One word.";
export async function neckClean(imageUrl: string): Promise<boolean> {
  if (!OPENAI_ENABLED) return true;
  try {
    const one = async () => {
      const r = await client().chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "user", content: [{ type: "text", text: JUDGE_Q }, { type: "image_url", image_url: { url: imageUrl } }] },
        ],
      });
      return (r.choices[0].message.content ?? "").trim().toUpperCase().startsWith("CLEAN");
    };
    const votes = await Promise.all([one(), one(), one()]);
    return votes.filter(Boolean).length >= 2;
  } catch {
    return true;
  }
}

// Generate `n` on-brand wizard variants with gpt-image-2, conditioned on the banner.
// `prompt` should already be the on-brand prompt (buildBannerPrompt from lib/fal.ts).
//
// gpt-image-2 renders the `n` images of a single call SEQUENTIALLY (~56s each), so we instead fire
// `n` PARALLEL n=1 calls — N variants then finish in ~one image's wall-time instead of N×. A failed
// individual call is dropped (filtered out); the caller 502s only if all fail.
export async function openaiWizardImages(
  prompt: string,
  n: number,
  quality: ImgQuality = "medium",
): Promise<string[]> {
  const bytes = await bannerBytes();
  const calls = Array.from({ length: n }, () =>
    client()
      .images.edit({
        model: "gpt-image-2",
        image: new File([bytes], "banner.png", { type: "image/png" }),
        prompt,
        n: 1,
        size: "1024x1024",
        quality,
      })
      .then((r) => r.data?.[0]?.b64_json ?? null)
      .catch(() => null),
  );
  const results = await Promise.all(calls);
  return results.filter((b): b is string => !!b).map((b) => `data:image/png;base64,${b}`);
}
