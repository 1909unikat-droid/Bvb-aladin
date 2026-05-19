"use client";
import { motion } from "framer-motion";

export function CurtainReveal() {
  return (
    <>
      <motion.div
        aria-hidden
        initial={{ y: 0 }}
        animate={{ y: "-100%" }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.85, 0, 0.15, 1] }}
        className="fixed inset-0 z-[200] bg-black pointer-events-none"
      />
      <motion.div
        aria-hidden
        initial={{ y: 0 }}
        animate={{ y: "-100%" }}
        transition={{ duration: 0.55, delay: 0.18, ease: [0.85, 0, 0.15, 1] }}
        className="fixed inset-0 z-[199] pointer-events-none"
        style={{ background: "var(--color-bvb-yellow)" }}
      />
    </>
  );
}
