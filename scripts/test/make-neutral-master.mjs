import { fal } from "@fal-ai/client";
import { writeFileSync, mkdirSync } from "node:fs";
fal.config({ credentials: process.env.FAL_KEY });
const MASTER = process.env.FAL_MASTER_URL;
const prompt =
  "Edit this image: COMPLETELY REMOVE the glowing orb the wizard is holding, and lower both arms into a natural, " +
  "relaxed standing pose with the hands hanging down at the sides, hands empty — NO object held, no orb anywhere. " +
  "Keep the character EXACTLY identical otherwise: the same dark face with two large glowing white oval eyes, the " +
  "same hood wrapping snugly and framing the face on EVERY side INCLUDING under the chin so NO neck or skin shows " +
  "below the face, the same black mitten gloves, the same simple one-piece A-line hooded robe with a curled pointed " +
  "hood tip and smooth sides, the same glossy cel-shaded cartoon style, and a simple plain dark background.";
mkdirSync("public/neutral", { recursive: true });
const r = await fal.subscribe("fal-ai/flux-pro/kontext", {
  input: { image_url: MASTER, prompt, guidance_scale: 3.5, num_images: 4, safety_tolerance: "5" },
});
const imgs = r.data.images || [];
console.log("got", imgs.length, "candidates");
for (let i = 0; i < imgs.length; i++) {
  const buf = Buffer.from(await (await fetch(imgs[i].url)).arrayBuffer());
  writeFileSync(`public/neutral/cand-${i}.png`, buf);
  console.log(`saved cand-${i}.png`);
}
