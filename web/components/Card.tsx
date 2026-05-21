"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ExternalLink, RefreshCw, Flame, GitBranch } from "lucide-react";
import type { NewsItem } from "@/types/news";
import { isHeroCandidate, isHot, isLive, isRedundantSummary } from "@/types/news";
import { TierBadge } from "./TierBadge";
import { ScoreBar } from "./ScoreBar";
import { CardTilt } from "./motion/CardTilt";
import { ConfettiBlast } from "./motion/ConfettiBlast";
import { CATEGORY_LABEL, KIND_LABEL, relativeTime } from "@/lib/news";
import { cn } from "@/lib/cn";
import type { SourceTrailOpener } from "@/lib/use-source-trail";

interface Props {
  item: NewsItem;
  variant?: "hero" | "standard" | "compact";
  index?: number;
  onSourceTrail?: SourceTrailOpener;
  /** Size of the story cluster this item belongs to (1 = standalone). */
  clusterSize?: number;
  /** Lead item id for the cluster — used as /thread/[id] route param. */
  clusterId?: string;
}

export function Card({ item, variant = "standard", index = 0, onSourceTrail, clusterSize, clusterId }: Props) {
  if (variant === "hero") return <HeroCard item={item} index={index} onSourceTrail={onSourceTrail} clusterSize={clusterSize} clusterId={clusterId} />;
  if (variant === "compact") return <CompactCard item={item} index={index} />;
  return <StandardCard item={item} index={index} onSourceTrail={onSourceTrail} clusterSize={clusterSize} clusterId={clusterId} />;
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

function StandardCard({ item, index, onSourceTrail, clusterSize, clusterId }: { item: NewsItem; index: number; onSourceTrail?: SourceTrailOpener; clusterSize?: number; clusterId?: string }) {
  const showSummary = !isRedundantSummary(item);
  const hot = isHot(item);
  const live = isLive(item);
  const hasCluster = (clusterSize ?? 1) > 1 && !!clusterId;

  return (
    <CardTilt className="h-full">
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, delay: Math.min(index * 0.03, 0.3), ease: "easeOut" }}
        className={cn(
          "relative h-full rounded-[--radius-card] bg-asphalt-800/70 backdrop-blur border border-asphalt-700 p-4 sm:p-5 transition-shadow",
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
            {hasCluster && (
              <Link
                href={`/thread/${clusterId}`}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-bvb-yellow/70 hover:text-bvb-yellow transition-colors border border-bvb-yellow/20 hover:border-bvb-yellow/50 rounded px-1 py-0.5"
                aria-label={`Thread: ${clusterSize} verwandte Meldungen`}
                onClick={(e) => e.stopPropagation()}
              >
                <GitBranch className="h-2.5 w-2.5" aria-hidden />
                {clusterSize} Thread
              </Link>
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
            {item.confirmation_count > 1 && onSourceTrail ? (
              <button
                type="button"
                onClick={() => onSourceTrail(item)}
                className="inline-flex items-center gap-1 text-bvb-yellow hover:text-white transition-colors text-[11px] font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bvb-yellow rounded"
                aria-label={`${item.confirmation_count} Quellen anzeigen`}
              >
                <RefreshCw className="h-3 w-3" /> {item.confirmation_count} Quellen
              </button>
            ) : item.confirmation_count > 1 ? (
              <span className="inline-flex items-center gap-1 text-bvb-yellow">
                <RefreshCw className="h-3 w-3" /> {item.confirmation_count} Quellen
              </span>
            ) : null}
          </div>
          <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" aria-hidden />
        </footer>
      </motion.article>
    </CardTilt>
  );
}

function HeroCard({ item, index, onSourceTrail, clusterSize, clusterId }: { item: NewsItem; index: number; onSourceTrail?: SourceTrailOpener; clusterSize?: number; clusterId?: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-bvb-yellow/30 bg-gradient-to-br from-asphalt-800 via-asphalt-900 to-black p-6 sm:p-8 glow-yellow"
    >
      <ConfettiBlast score={item.score} />
      <div className="absolute inset-0 stripes-y opacity-[0.04] pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <TierBadge tier={item.tier} source={item.source} />
          <span className="text-xs text-neutral-400">
            {CATEGORY_LABEL[item.category]} · {relativeTime(item.published)}
          </span>
          {onSourceTrail ? (
            <button
              type="button"
              onClick={() => onSourceTrail(item)}
              aria-label="Score-Transparenz anzeigen"
              className="focus-visible:ring-1 focus-visible:ring-bvb-yellow rounded"
            >
              <ScoreBar score={item.score} />
            </button>
          ) : (
            <ScoreBar score={item.score} />
          )}
          {item.confirmation_count > 1 && onSourceTrail && (
            <button
              type="button"
              onClick={() => onSourceTrail(item)}
              className="inline-flex items-center gap-1 text-[11px] text-bvb-yellow hover:text-white transition-colors font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bvb-yellow rounded"
            >
              <RefreshCw className="h-3 w-3" /> {item.confirmation_count} Quellen
            </button>
          )}
          {(clusterSize ?? 1) > 1 && clusterId && (
            <Link
              href={`/thread/${clusterId}`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-bvb-yellow/80 hover:text-bvb-yellow border border-bvb-yellow/30 hover:border-bvb-yellow/60 rounded px-1.5 py-0.5 transition-colors"
            >
              <GitBranch className="h-3 w-3" aria-hidden />
              {clusterSize} Thread
            </Link>
          )}
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
