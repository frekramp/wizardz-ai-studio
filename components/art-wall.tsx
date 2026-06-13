import { WIZARD_TILES } from "@/lib/wizard-tiles";
import { CursorSpotlight } from "@/components/cursor-spotlight";

// Duplicate so the wall fills wide/tall viewports; capped for performance.
const TILES = [...WIZARD_TILES, ...WIZARD_TILES].slice(0, 72);

export function ArtWall() {
  return (
    <div className="artwall" aria-hidden="true">
      <div className="artwall-grid">
        {TILES.map((src, i) => (
          <div className="artwall-tile" key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
      <div className="artwall-veil" />
      <div className="bgfx-prism" />
      <div className="bgfx-grain" />
      <CursorSpotlight />
    </div>
  );
}
