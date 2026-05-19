"use client";
import { motion } from "framer-motion";
import { LiveDot } from "./LiveDot";
import { SuedtribueneChant } from "./SuedtribueneChant";

interface Props {
  totalItems: number;
  updatedAt: string;
}

export function Hero({ totalItems, updatedAt }: Props) {
  const updated = (() => {
    try {
      return new Date(updatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  })();

  return (
    <section className="relative overflow-hidden noise">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] stripes-y"
        style={{ transform: "skewY(-2deg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bvb-yellow/[0.08] via-transparent to-asphalt-950 pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-8 sm:pt-16 sm:pb-12 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-center">
        <div className="md:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-bvb-yellow"
          >
            <LiveDot />
            <span>Echte Liebe · Live-Feed</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
            className="mt-3 text-balance text-4xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Alles{" "}
            <span className="bg-bvb-yellow text-black px-2 inline-block -skew-x-6">Schwarz‑Gelb</span>
            <br />
            an einem Ort.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85 }}
            className="mt-4 text-neutral-300 max-w-xl text-base sm:text-lg leading-relaxed"
          >
            Der BVB-Hub bündelt {totalItems} aktuelle Stories aus 40+ Insider-, Medien-,
            Podcast- und Social-Quellen — gewichtet nach Glaubwürdigkeit und Bestätigung.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.05 }}
            className="mt-5 text-xs text-neutral-500"
          >
            Letzte Aktualisierung: <span className="text-neutral-300">{updated} Uhr</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
          className="md:col-span-5 flex justify-center md:justify-end"
        >
          <SuedtribueneChant />
        </motion.div>
      </div>
    </section>
  );
}
