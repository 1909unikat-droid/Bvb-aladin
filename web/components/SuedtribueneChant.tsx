"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";

const CHANTS = [
  "HEJA BVB",
  "ECHTE LIEBE",
  "SCHWARZ‑GELB",
  "JA JA BORUSSIA",
  "WIR SIND DIE BORUSSEN",
  "SÜÜÜD ‑ TRIBÜÜÜNE!",
];

export function SuedtribueneChant() {
  const [chantIdx, setChantIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const id = setInterval(
      () => setChantIdx((i) => (i + 1) % CHANTS.length),
      2400,
    );
    return () => clearInterval(id);
  }, []);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    if (!next) {
      v.volume = 0.8;
      // Browsers sometimes pause when unmuting; ensure playing
      v.play().catch(() => {});
    }
    setMuted(next);
  };

  return (
    <div
      aria-label="Südtribüne mit Fangesang"
      className="relative aspect-[9/16] w-full max-w-[260px] sm:max-w-[300px] mx-auto rounded-2xl overflow-hidden border border-bvb-yellow/40 bg-black glow-yellow"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/sued/wall.mp4"
        poster="/sued/wall-poster.webp"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />

      {/* Vignette für Lesbarkeit */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/70 pointer-events-none" />

      {/* Fangesang-Cycling — mittig prominent */}
      <div className="absolute inset-x-0 top-[58%] -translate-y-1/2 flex justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={chantIdx}
            initial={{ opacity: 0, y: 16, skewX: -14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, skewX: -8, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="bg-bvb-yellow text-black font-black px-3 py-1 text-lg sm:text-2xl tracking-tight shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {CHANTS[chantIdx]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Audio-Toggle oben rechts */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={muted ? "Fangesang anhören" : "Fangesang stummschalten"}
        className="absolute top-2 right-2 inline-flex items-center gap-1 bg-black/70 hover:bg-black text-bvb-yellow border border-bvb-yellow/50 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold backdrop-blur-sm transition-colors focus:outline-none focus:ring-2 focus:ring-bvb-yellow"
      >
        {muted ? <Volume2 size={12} /> : <VolumeX size={12} />}
        {muted ? "Ton" : "Mute"}
      </button>

      {/* Live-Pulse oben links */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/65 backdrop-blur-sm rounded-full px-2 py-1 text-[10px] uppercase tracking-widest font-bold text-bvb-yellow">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-bvb-yellow opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-bvb-yellow" />
        </span>
        Süd
      </div>

      {/* Caption */}
      <div className="absolute bottom-2 left-3 right-3 pointer-events-none">
        <div className="text-bvb-yellow font-bold uppercase tracking-wider text-[10px] sm:text-xs">
          Südtribüne
        </div>
        <div className="text-neutral-200/95 text-[10px] sm:text-xs">
          25.000 · Echte Liebe · Yellow Wall
        </div>
      </div>
    </div>
  );
}
