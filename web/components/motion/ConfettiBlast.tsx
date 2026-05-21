"use client";

import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";

interface Props {
  /** Score of the item — blast only fires when score >= 9. */
  score: number;
  /** Origin x ratio 0–1 relative to the viewport. Default 0.5. */
  originX?: number;
}

/**
 * Fires a BVB-yellow confetti burst once when the parent enters the viewport,
 * but only for items with score >= 9.
 * Renders nothing — pure side-effect.
 */
export function ConfettiBlast({ score, originX = 0.5 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const fired = useRef(false);

  useEffect(() => {
    if (!inView || fired.current || score < 9) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    fired.current = true;

    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { x: originX, y: 0.6 },
        colors: ["#fde100", "#ffffff", "#000000", "#fde100"],
        ticks: 180,
        gravity: 1.1,
        scalar: 0.85,
        startVelocity: 28,
      });
      // Second burst after 200ms for depth
      setTimeout(() => {
        confetti({
          particleCount: 30,
          spread: 70,
          origin: { x: Math.max(0.05, originX - 0.08), y: 0.62 },
          colors: ["#fde100", "#fde100", "#ffffff"],
          ticks: 140,
          gravity: 1.2,
          scalar: 0.7,
          startVelocity: 22,
        });
      }, 200);
    });
  }, [inView, score, originX]);

  // Invisible sentinel element used for IntersectionObserver
  return <span ref={ref} aria-hidden className="sr-only" />;
}
