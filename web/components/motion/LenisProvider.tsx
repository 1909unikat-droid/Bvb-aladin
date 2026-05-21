"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { canUseSmoothScroll } from "@/lib/motion-flags";

/**
 * Wraps the app in Lenis smooth-scroll.
 * Automatically disabled for prefers-reduced-motion.
 * Plays nicely with Framer Motion (uses RAF via Lenis.raf).
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!canUseSmoothScroll()) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.8,
      infinite: false,
    });
    lenisRef.current = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
