"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import type { NewsItem } from "@/types/news";
import { TierBadge } from "@/components/TierBadge";
import { relativeTime } from "@/lib/news";
import { cn } from "@/lib/cn";

interface Props {
  item: NewsItem | null;
  onClose: () => void;
}

const AXIS_LABELS: Record<keyof NewsItem["components"], string> = {
  credibility:  "Quellen-Glaubwürdigkeit",
  confirmation: "Mehrfach-Bestätigung",
  recency:      "Aktualität",
  specificity:  "Konkretheit",
  relevance:    "BVB-Bezug",
};

const AXIS_ORDER: (keyof NewsItem["components"])[] = [
  "credibility", "confirmation", "recency", "specificity", "relevance"
];

const AXIS_WEIGHTS = [0.35, 0.25, 0.20, 0.10, 0.10];

export function SourceTrailModal({ item, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item, onClose]);

  // Trap scroll
  useEffect(() => {
    if (item) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Quellen-Transparenz"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-hidden />

          {/* Panel */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className={cn(
              "relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto",
              "rounded-t-2xl sm:rounded-2xl",
              "bg-asphalt-900 border border-asphalt-600",
              "shadow-[0_-8px_60px_rgba(253,225,0,0.08)]"
            )}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-3 bg-asphalt-900 border-b border-asphalt-700">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-bvb-yellow font-bold">
                  Quellen-Transparenz
                </p>
                <h2 className="mt-0.5 text-sm font-semibold text-neutral-100 line-clamp-2">
                  {item.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Schließen"
                className="ml-3 shrink-0 h-8 w-8 grid place-items-center rounded-full bg-asphalt-700 hover:bg-asphalt-600 text-neutral-300 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-bvb-yellow"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-6">
              {/* Score summary */}
              <div className="flex items-center gap-3">
                <div className="text-4xl font-black text-bvb-yellow tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                  {item.score.toFixed(1)}
                </div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  von 10 möglichen Punkten<br />
                  <span className="text-neutral-500">Gewichteter Score aus 5 Faktoren</span>
                </div>
              </div>

              {/* Radar bars */}
              <div className="space-y-2.5" aria-label="Score-Faktoren">
                {AXIS_ORDER.map((axis, i) => {
                  const val = item.components[axis];
                  const pct = Math.round(val * 100);
                  const weight = AXIS_WEIGHTS[i];
                  return (
                    <div key={axis}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-neutral-300 font-medium">{AXIS_LABELS[axis]}</span>
                        <span className="text-neutral-500 tabular-nums">
                          {pct}% <span className="text-neutral-600">· {Math.round((weight ?? 0) * 100)}% Gewicht</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-asphalt-700 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: 0.08 * i, ease: "easeOut" }}
                          className={cn(
                            "h-full rounded-full",
                            pct >= 70 ? "bg-bvb-yellow" :
                            pct >= 40 ? "bg-bvb-yellow/60" :
                            "bg-asphalt-500"
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Confirmations */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500 font-bold mb-3">
                  {item.confirmation_count === 1 ? "Quelle" : `${item.confirmation_count} bestätigende Quellen`}
                </p>
                <ul className="space-y-2">
                  {item.confirmations.map((c, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 py-2 border-b border-asphalt-700 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <TierBadge tier={c.tier} source={c.source} />
                        <span className="text-xs text-neutral-400 truncate">
                          {c.published ? relativeTime(c.published) : ""}
                        </span>
                      </div>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${c.source} öffnen`}
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] text-bvb-yellow hover:text-white transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Original
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tier legend */}
              <div className="rounded-xl bg-asphalt-800 p-3 text-[10px] text-neutral-500 leading-relaxed">
                <span className="text-neutral-400 font-semibold">Tier 1</span> Insider-Journalisten ·{" "}
                <span className="text-neutral-400 font-semibold">Tier 2</span> Etablierte Medien ·{" "}
                <span className="text-neutral-400 font-semibold">Tier 3</span> Offizielle BVB-Kanäle ·{" "}
                <span className="text-neutral-400 font-semibold">Tier 4</span> Tabloid/Fan-Medien ·{" "}
                <span className="text-neutral-400 font-semibold">Tier 5</span> Social/Community
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
