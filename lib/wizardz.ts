// The 333 Wizardz, keyed by collection number (#). Built once from Ordinals Wallet's public
// API via scripts/build-wizard-index.mjs and committed as lib/wizardz-index.json, so the
// runtime needs no indexer API key. The wizard's art is the keyless ord content gateway.
import indexData from "./wizardz-index.json";

export type WizardEntry = {
  n: number; // collection number, e.g. 123 for "Wizardz #123"
  id: string; // inscription id (…i0)
  attributes?: { trait_type: string; value: string }[];
};

const INDEX = indexData as WizardEntry[];
const BY_N = new Map<number, WizardEntry>(INDEX.map((w) => [w.n, w]));

export const WIZARDZ_COUNT = INDEX.length;
export const WIZARDZ_MAX_N = INDEX.reduce((m, w) => Math.max(m, w.n), 0);

export function wizardByNumber(n: number): WizardEntry | null {
  return BY_N.get(n) ?? null;
}

// Same keyless ord gateway used by the art-wall tiles (lib/wizard-tiles.ts).
export function imageUrlFor(n: number): string | null {
  const w = BY_N.get(n);
  return w ? `https://ord.satflow.com/content/${w.id}` : null;
}

// Flatten traits into a label string ("Background: Cosmic, Cloak: Crimson") — for the UI/preview.
export function traitTextFor(n: number): string | null {
  const w = BY_N.get(n);
  if (!w?.attributes?.length) return null;
  return w.attributes.map((a) => `${a.trait_type}: ${a.value}`).join(", ");
}

// Natural-language trait phrases for an image prompt ("orange robe, green background, fire spell").
// Hand traits read as the action/object alone; everything else as "<value> <trait_type>".
export function traitPhrasesFor(n: number): string | null {
  const w = BY_N.get(n);
  if (!w?.attributes?.length) return null;
  return w.attributes
    .map((a) => (a.trait_type.toLowerCase().includes("hand") ? a.value : `${a.value} ${a.trait_type}`))
    .join(", ");
}

export function allInscriptionIds(): string[] {
  return INDEX.map((w) => w.id);
}

// Sorted list of minted collection numbers (the set has gaps — e.g. #9/#115/#129).
export function allNumbers(): number[] {
  return INDEX.map((w) => w.n).sort((a, b) => a - b);
}
