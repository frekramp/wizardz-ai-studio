import { fal } from "@fal-ai/client";
import { writeFileSync, mkdirSync } from "node:fs";
fal.config({ credentials: process.env.FAL_KEY });
const MASTER = process.env.FAL_MASTER_URL;
function masterV3(req) {
  return (
    "Transform this exact wizard into a brand-new illustration that VIVIDLY depicts the request below. " +
    "Actually render the described subject, action, scene, clothing and props — do NOT merely recolour the existing pose. " +
    "KEEP IDENTICAL (the character's identity): the dark featureless face with two large glowing white oval eyes; " +
    "the hood wrapping snugly around the face and framing it on EVERY side INCLUDING under the chin so NO neck, throat " +
    "or skin shows below the face; the smooth black mitten gloves; the simple one-piece A-line hooded-robe SHAPE with a " +
    "curled pointed hood tip and smooth sides (no cape, no flaps); and the glossy cel-shaded cartoon style with bold " +
    "clean outlines and soft lighting. " +
    "CHANGE FREELY to match the request: the pose and body position, the entire background and scene, any props or " +
    "objects the hands hold or use, and the robe's colour and pattern. " +
    "IMPORTANT: do NOT default to cradling a plain glowing orb — only include a glowing orb if the request explicitly " +
    "asks for one; otherwise the hands do exactly what the request describes (hold the staff, brew the potion, ride the " +
    "board, etc.). The requested subject and setting must be obvious at a glance. " +
    `Request: ${req}`
  );
}
const PROMPTS = [
  ["potion", "potion-brewing trickster wizard"],
  ["staff", "a wise wizard with a glowing staff"],
  ["galaxy", "cosmic sorcerer in a galaxy robe"],
  ["surf", "riding a cosmic surfboard"],
];
mkdirSync("public/necktest-v3", { recursive: true });
for (const [name, req] of PROMPTS) {
  process.stdout.write(`${name} … `);
  try {
    const r = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: { image_url: MASTER, prompt: masterV3(req), guidance_scale: 3.5, num_images: 1, safety_tolerance: "5" },
    });
    const buf = Buffer.from(await (await fetch(r.data.images[0].url)).arrayBuffer());
    writeFileSync(`public/necktest-v3/${name}.png`, buf);
    console.log("✓");
  } catch (e) { console.log("✗", e?.message || e); }
}
console.log("done");
