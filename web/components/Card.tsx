"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ExternalLink, RefreshCw, Flame } from "lucide-react";
import type { NewsItem } from "@/types/news";
import { isHeroCandidate, isHot, isLive, isRedundantSummary } from "@/types/news";
import { TierBadge } from "./TierBadge";
import { ScoreBar } from "./ScoreBar";
import { CATEGORY_LABEL, KIND_LABEL, relativeTime } from "@/lib/news";
import { cn } from "@/lib/cn";

interface Props {
  item: NewsItem;
  variant?: "hero" | "standard" | "compact";
  index?: number;
}

export function Card({ item, variant = "standard", index = 0 }: Props) {
  if (variant === "hero") return <HeroCard item={item} index={index} />;
  if (variant === "compact") return <CompactCard item={item} index={index} />;
  return <StandardCard item={item} index={index} />;
}

function CardLink({
  item,
  className,
  children
}: {
  item: NewsItem;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("block group focus:outline-none", className)}
    >
      {children}
    </Link>
  );
}

function StandardCard({ item, index }: { item: NewsItem; index: number }) {
  const showSummary = !isRedundantSummary(item);
  const hot = isHot(item);
  const live = isLive(item);
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.03, 0.3), ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={cn(
        "relative rounded-[--radius-card] bg-asphalt-800/70 backdrop-blur border border-asphalt-700 p-4 sm:p-5 transition-shadow",
        "hover:border-bvb-yellow/50 hover:glow-yellow",
        item.tier === 1 && "border-bvb-yellow/40"
      )}
    >
      <header className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TierBadge tier={item.tier} source={item.source} />
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
            {CATEGORY_LABEL[item.category]} · {KIND_LABEL[item.kind]}
          </span>
          {hot && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
              <Flame className="h-3 w-3" aria-hidden /> HOT
            </span>
          )}
        </div>
        <ScoreBar score={item.score} />
      </header>

      <CardLink item={item}>
        <h3 className="text-base sm:text-lg font-bold text-balance leading-snug group-hover:text-bvb-yellow transition-colors">
          {item.title}
        </h3>
        {showSummary && (
          <p className="mt-2 text-sm text-neutral-400 line-clamp-3 leading-relaxed">
            {item.summary}
          </p>
        )}
      </CardLink>

      <footer className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <div className="flex items-center gap-2">
          {live && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-bvb-yellow animate-pulse" aria-label="frisch" />}
          <span>{relativeTime(item.published)}</span>
          {item.confirmation_count > 1 && (
            <span className="inline-flex items-center gap-1 text-bvb-yellow">
              <RefreshCw className="h-3 w-3" /> {item.confirmation_count} Quellen
            </span>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" aria-hidden />
      </footer>
    </motion.article>
  );
}

function HeroCard({ item, index }: { item: NewsItem; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-bvb-yellow/30 bg-gradient-to-br from-asphalt-800 via-asphalt-900 to-black p-6 sm:p-8 glow-yellow"
    >
      <div className="absolute inset-0 stripes-y opacity-[0.04] pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <TierBadge tier={item.tier} source={item.source} />
          <span className="text-xs text-neutral-400">
            {CATEGORY_LABEL[item.category]} · {relativeTime(item.published)}
          </span>
          <ScoreBar score={item.score} />
        </div>
        <CardLink item={item}>
          <h2
            className="text-balance text-2xl sm:text-4xl font-black tracking-tight leading-[1.05] line-clamp-4 group-hover:text-bvb-yellow transition-colors"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            {item.title}
          </h2>
          {!isRedundantSummary(item) && (
            <p className="mt-3 text-neutral-300 line-clamp-3 max-w-3xl">{item.summary}</p>
          )}
          <span className="mt-4 inline-flex items-center gap-2 text-bvb-yellow text-sm font-semibold">
            Zur Story <ExternalLink className="h-4 w-4" />
          </span>
        </CardLink>
      </div>
    </motion.article>
  );
}

function CompactCard({ item, index }: { item: NewsItem; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, x: 12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="snap-start shrink-0 w-[260px] sm:w-[300px] rounded-xl border border-asphalt-700 bg-asphalt-800/70 p-3 hover:border-bvb-yellow/50 transition-colors"
    >
      <CardLink item={item}>
        <div className="flex items-center justify-between mb-1.5">
          <TierBadge tier={item.tier} source={item.source} />
          <span className="text-[10px] text-neutral-500">{relativeTime(item.published)}</span>
        </div>
        <h4 className="text-sm font-semibold leading-snug line-clamp-3 group-hover:text-bvb-yellow transition-colors">
          {item.title}
        </h4>
      </CardLink>
    </motion.article>
  );
}

export { isHeroCandidate };
