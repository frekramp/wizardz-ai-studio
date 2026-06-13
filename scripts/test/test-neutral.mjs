import { fal } from "@fal-ai/client";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
fal.config({ credentials: process.env.FAL_KEY });
// Upload the chosen neutral master to fal.storage for a stable URL:
const buf = readFileSync("public/neutral/cand-1.png");
const NEUTRAL = await fal.storage.upload(new Blob([buf], { type: "image/png" }));
console.log("NEUTRAL master URL:", NEUTRAL);
writeFileSync("public/neutral/URL.txt", NEUTRAL);

function v3(req) {
  return (
    "Transform this exact wizard into a brand-new illustration that VIVIDLY depicts the request below. " +
    "Actually render the described subject, action, scene, clothing and props. " +
    "KEEP IDENTICAL (identity): the dark face with two large glowing white oval eyes; the hood wrapping snugly and " +
    "framing the face on EVERY side INCLUDING under the chin so NO neck/throat/skin shows below the face; the black " +
    "mitten gloves; the simple one-piece A-line hooded-robe SHAPE with a curled pointed hood tip and smooth sides (no " +
    "cape/flaps); and the glossy cel-shaded cartoon style with bold outlines and soft lighting. " +
    "CHANGE FREELY: pose, body position, the entire background/scene, any props the hands hold or use, and the robe's " +
    "colour/pattern. The requested subject and setting must be obvious at a glance. " +
    `Request: ${req}`
  );
}
const PROMPTS = [
  ["potion", "potion-brewing trickster wizard with a bubbling cauldron"],
  ["staff", "a wise wizard with a glowing staff"],
  ["galaxy", "cosmic sorcerer in a galaxy robe"],
  ["surf", "riding a cosmic surfboard"],
  ["coffee", "GM, holding a steaming coffee mug at sunrise"],
];
mkdirSync("public/neutral-test", { recursive: true });
for (const [name, req] of PROMPTS) {
  process.stdout.write(`${name} … `);
  try {
    const r = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: { image_url: NEUTRAL, prompt: v3(req), guidance_scale: 3.5, num_images: 1, safety_tolerance: "5" },
    });
    writeFileSync(`public/neutral-test/${name}.png`, Buffer.from(await (await fetch(r.data.images[0].url)).arrayBuffer()));
    console.log("✓");
  } catch (e) { console.log("✗", e?.message || e); }
}
console.log("done");
