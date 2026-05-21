"use client";
import { motion } from "framer-motion";
import { scoreSegments } from "@/types/news";

export function ScoreBar({ score }: { score: number }) {
  const segs = scoreSegments(score);
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={`Score ${score.toFixed(1)} von 10`}
      title={`Score ${score.toFixed(2)}`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0.4, opacity: 0.3 }}
          whileInView={{ scaleY: 1, opacity: i < segs ? 1 : 0.18 }}
          viewport={{ once: true, margin: "-10px" }}
          transition={{ duration: 0.6, delay: 0.04 * i, ease: "easeOut" }}
          className={`h-3 w-[3px] rounded-sm origin-bottom ${i < segs ? "bg-bvb-yellow" : "bg-asphalt-500"}`}
        />
      ))}
    </div>
  );
}
