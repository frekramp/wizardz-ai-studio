"use client";

import { useEffect } from "react";

/**
 * Tracks the pointer and exposes it as --mx / --my on :root so the art-wall
 * veil (a masked "torch hole") and the warm glow follow the cursor.
 */
export function CursorSpotlight() {
  useEffect(() => {
    let raf = 0;
    let x = -300;
    let y = -300;
    const root = document.documentElement;
    const apply = () => {
      raf = 0;
      root.style.setProperty("--mx", `${x}px`);
      root.style.setProperty("--my", `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div className="artwall-spot" aria-hidden="true" />;
}
