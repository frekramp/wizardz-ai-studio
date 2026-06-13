import { WIZARD_TILES } from "./wizard-tiles";
import { allInscriptionIds } from "./wizardz";

// Inscription IDs that count as "a Wizardz". Once lib/wizardz-index.json is built
// (scripts/build-wizard-index.mjs) this is the full 333; until then it falls back to the
// art-wall tiles so the ownership gate still works.
export const WIZARDZ_IDS: ReadonlySet<string> = new Set([
  ...allInscriptionIds(),
  ...WIZARD_TILES.map((u) => u.split("/content/")[1]).filter((x): x is string => !!x),
]);
