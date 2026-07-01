// MEME MODE presets — the single place to add/edit crypto-meme templates. Each preset maps a short
// tag → the scene/action prompt fed to the focused master engine (same path as masterRequest) plus
// the caption text + where it sits. Pure data + sanitizers; safe to import on the client (the UI) and
// the server (the generate route). The actual text overlay lives in lib/fal.ts (captionImage).

export type CaptionPosition = "top" | "bottom";

export type MemePreset = {
  tag: string; // short id, also the typeable shortcut (lowercase)
  label: string; // button label in the UI
  prompt: string; // scene/action — becomes the master engine's request (lead with scene + action)
  caption: string; // text overlaid on the final image
  position: CaptionPosition; // where the caption sits
};

// Add or edit memes here — one entry per template. Order = button order in the UI.
export const MEME_PRESETS: MemePreset[] = [
  { tag: "gm", label: "GM", prompt: "holding a steaming cup of coffee, cozy sunrise through a window, cheerful", caption: "GM", position: "top" },
  { tag: "gn", label: "GN", prompt: "sleeping peacefully tucked in bed, night sky with stars and moon", caption: "GN", position: "top" },
  { tag: "wagmi", label: "WAGMI", prompt: "arms raised in triumph, confetti, glowing", caption: "WAGMI", position: "bottom" },
  { tag: "ngmi", label: "NGMI", prompt: "sitting dejected in the rain, gloomy", caption: "NGMI", position: "bottom" },
  { tag: "hodl", label: "HODL", prompt: "gripping a glowing bitcoin coin tightly with both hands, determined", caption: "HODL", position: "bottom" },
  { tag: "to the moon", label: "To the Moon", prompt: "riding a rocket into space, earth below, stars", caption: "TO THE MOON", position: "bottom" },
  { tag: "diamond hands", label: "Diamond Hands", prompt: "holding glowing diamonds in both open hands", caption: "DIAMOND HANDS", position: "bottom" },
  { tag: "rekt", label: "REKT", prompt: "knocked over, dizzy, chart crashing down in background", caption: "REKT", position: "bottom" },
];

export const MEME_MAX_CAPTION = 40;

// Resolve a typed/clicked tag to its preset. Case-insensitive; matches the tag or the label so both
// "gm" and "To the Moon" work.
export function findMemePreset(tag: string | undefined | null): MemePreset | undefined {
  if (!tag) return undefined;
  const t = tag.trim().toLowerCase();
  if (!t) return undefined;
  return MEME_PRESETS.find((m) => m.tag === t || m.label.toLowerCase() === t);
}

// Clean a caption for overlay: strip control chars, collapse whitespace, cap length. The XML/SVG
// escaping happens at render time (lib/fal.ts) — this only normalizes the raw user/preset text.
export function sanitizeCaption(s: string | undefined | null): string {
  if (!s) return "";
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    out += c < 0x20 || c === 0x7f ? " " : ch; // drop control chars (incl. DEL)
  }
  return out.replace(/\s+/g, " ").trim().slice(0, MEME_MAX_CAPTION);
}

export function normalizeCaptionPosition(p: string | undefined | null): CaptionPosition {
  return p === "top" ? "top" : "bottom";
}
