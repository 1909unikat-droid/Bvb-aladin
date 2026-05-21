"use client";

/**
 * Capability detection for motion & 3D.
 * Capability-based (NOT desktop-only) — iPad/iPhone with WebGL2 = OK.
 * Low-end: deviceMemory < 2GB, hardwareConcurrency < 4, no WebGL2 → CSS fallback.
 */

let _cached: boolean | null = null;

export function canUse3D(): boolean {
  if (typeof window === "undefined") return false;
  if (_cached !== null) return _cached;

  // prefers-reduced-motion wins
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return (_cached = false);
  }

  // WebGL2 required
  try {
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2")) return (_cached = false);
  } catch {
    return (_cached = false);
  }

  // Memory gate: skip if device reports < 2 GB RAM
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem < 2) return (_cached = false);

  // CPU gate: skip below 4 logical cores
  if (navigator.hardwareConcurrency < 4) return (_cached = false);

  return (_cached = true);
}

/** True if smooth-scroll (Lenis) is allowed. */
export function canUseSmoothScroll(): boolean {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True if GSAP ScrollTrigger pinning should be active. */
export function canUseScrollTrigger(): boolean {
  return canUseSmoothScroll();
}

/** Reset cache (useful in tests). */
export function resetMotionCache(): void {
  _cached = null;
}
