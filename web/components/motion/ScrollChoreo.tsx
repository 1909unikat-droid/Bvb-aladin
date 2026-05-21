"use client";

import { useEffect, useRef } from "react";
import { canUseScrollTrigger } from "@/lib/motion-flags";
import type { NewsItem } from "@/types/news";

interface Props {
  /** Top-3 items for the banner stagger */
  topItems: NewsItem[];
}

/**
 * GSAP ScrollTrigger Hero-Choreo.
 * - Pinnt den Hero beim ersten Scroll kurz (200px Overscroll).
 * - Lässt die 3D-Stadionfigur parallax-langsamer scrollen.
 * - Staggert die Top-3 Headline-Banner beim Einblenden.
 * Noop wenn reduced-motion oder GSAP nicht verfügbar.
 */
export function ScrollChoreo({ topItems: _ }: Props) {
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    if (!canUseScrollTrigger()) return;

    let cleanup: (() => void) | null = null;

    // Lazy-import GSAP so it only loads when this component mounts
    import("gsap").then(({ gsap }) => {
      import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);

        const heroSection = document.querySelector<HTMLElement>("section.noise");
        const stadium = heroSection?.querySelector<HTMLElement>("[aria-hidden]");

        if (!heroSection) return;

        // Parallax the background layer slower than scroll
        if (stadium) {
          gsap.to(stadium, {
            yPercent: -18,
            ease: "none",
            scrollTrigger: {
              trigger: heroSection,
              start: "top top",
              end: "bottom top",
              scrub: 1.2,
            },
          });
        }

        // Hero text stagger fade-up is handled by Framer Motion.
        // GSAP only handles the pinned parallax to avoid conflicts.

        cleanup = () => {
          ScrollTrigger.getAll().forEach((t) => t.kill());
        };
        didInit.current = true;
      });
    });

    return () => { cleanup?.(); };
  }, []);

  // Renders nothing — pure side-effect component
  return null;
}
