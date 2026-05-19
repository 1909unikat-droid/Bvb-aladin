"use client";
import { motion } from "framer-motion";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  count?: number;
}

export function SectionHeader({ eyebrow, title, description, count }: Props) {
  return (
    <header className="mb-6 sm:mb-8">
      {eyebrow && (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="text-xs uppercase tracking-[0.3em] text-bvb-yellow font-bold"
        >
          {eyebrow}
        </motion.div>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="mt-1 text-3xl sm:text-4xl font-black tracking-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
        {typeof count === "number" && (
          <span className="ml-3 align-middle text-base text-neutral-500 font-mono">
            {count.toString().padStart(2, "0")}
          </span>
        )}
      </motion.h2>
      {description && (
        <p className="mt-2 text-sm text-neutral-400 max-w-2xl">{description}</p>
      )}
    </header>
  );
}
