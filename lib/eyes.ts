// EYES trait — the wizard's eye shape is chosen by the prompt (or a UI picker) and applied as a
// transparent-PNG OVERLAY onto a blank-faced base (the image model never draws the eyes). This file is
// pure data + parsing (safe on client + server); the actual compositing lives in lib/fal.ts (applyEyes)
// and the art in public/brand/eyes/<key>.png.

export type EyeKey =
  | "rage" | "wut" | "flame" | "diamond" | "fent" | "sleepy" | "joy"
  | "stoic" | "wide" | "focused" | "loopy" | "stern" | "og";

// Order = eye-picker order in the UI. og last so it reads as the "default/classic".
export const EYE_KEYS: EyeKey[] = [
  "rage", "wut", "flame", "diamond", "fent", "sleepy", "joy",
  "stoic", "wide", "focused", "loopy", "stern", "og",
];

export const EYE_LABELS: Record<EyeKey, string> = {
  rage: "Rage", wut: "Wut", flame: "Flame", diamond: "Diamond", fent: "Fent",
  sleepy: "Sleepy", joy: "Joy", stoic: "Stoic", wide: "Wide", focused: "Focused",
  loopy: "Loopy", stern: "Stern", og: "OG",
};

// Prompt keyword → eye, ordered (first match wins). Keywords kept tight to avoid colliding with scene
// words: "flame"/"fire-eyes" (NOT bare "fire", which would catch fireball scenes); no "cheerful"
// (it's in the gm meme preset). Each entry follows the user's requested synonym mapping.
const EYE_RULES: Array<[RegExp, EyeKey]> = [
  [/\b(angry|rage|furious)\b/, "rage"],
  [/\b(wut|confused)\b/, "wut"],
  [/\b(flame|flaming|fire[-\s]?eyes)\b/, "flame"],
  [/\bdiamond\b/, "diamond"],
  [/\bfent\b/, "fent"],
  [/\b(sleepy|tired)\b/, "sleepy"],
  [/\b(happy|joy|joyful)\b/, "joy"],
  [/\bstoic\b/, "stoic"],
  [/\b(wide|shocked|surprised)\b/, "wide"],
  [/\bfocused\b/, "focused"],
  [/\b(crazy|loopy)\b/, "loopy"],
  [/\bstern\b/, "stern"],
  [/\b(og|default)\b/, "og"],
];

// Find an eye trait in free text. Returns null when NO eye keyword is present — callers keep the
// normal glowing eyes (no blank face, no overlay) so non-eye prompts are unchanged.
export function pickEyeTrait(prompt: string): EyeKey | null {
  const text = ` ${prompt.toLowerCase()} `;
  for (const [re, key] of EYE_RULES) if (re.test(text)) return key;
  return null;
}

// Normalize an explicit eye value (UI picker, or a typed word) to a valid key; default og.
export function normalizeEye(v: string | undefined | null): EyeKey {
  if (!v) return "og";
  const t = v.trim().toLowerCase();
  if ((EYE_KEYS as string[]).includes(t)) return t as EyeKey;
  return pickEyeTrait(t) ?? "og";
}
