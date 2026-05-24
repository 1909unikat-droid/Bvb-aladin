import { fetchFeedServer } from "@/lib/news-server";
import { Hero } from "@/components/Hero";
import { CardGrid } from "@/components/CardGrid";
import { SectionHeader } from "@/components/SectionHeader";
import { TopStrip } from "@/components/TopStrip";
import { TierPulseLazy } from "@/components/pulse/TierPulseLazy";
import { JsonLd } from "@/components/JsonLd";
import { computeVibeIndex, VIBE_DESCRIPTIONS, VIBE_COLORS } from "@/lib/vibe-index";
import type { Tier } from "@/types/news";

export const revalidate = 60;

export default async function HomePage() {
  const feed = await fetchFeedServer();
  const byDate = (a: { published?: string }, b: { published?: string }) =>
    new Date(b.published ?? 0).getTime() - new Date(a.published ?? 0).getTime();
  const seen = new Set<string>();
  const items = [...feed.items]
    .filter((it) => { if (seen.has(it.id)) return false; seen.add(it.id); return true; })
    .sort(byDate);
  const top = items.slice(0, 8);
  const rest = items.slice(0, 60);

  // Tier counts for pulse (all items, not just top)
  const tierCounts = feed.items.reduce<Partial<Record<Tier, number>>>((acc, it) => {
    acc[it.tier] = (acc[it.tier] ?? 0) + 1;
    return acc;
  }, {});

  const vibe = computeVibeIndex(feed.items);

  // JSON-LD structured data
  const sportsTeamSchema = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: "Borussia Dortmund",
    alternateName: "BVB 09",
    sport: "Football",
    url: "https://www.bvb.de",
    location: { "@type": "Place", name: "Signal Iduna Park, Dortmund" },
  };

  const topItem = items[0];
  const newsArticleSchema = topItem
    ? {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: topItem.title.slice(0, 110),
        datePublished: topItem.published ?? feed.updated_at,
        dateModified: feed.updated_at,
        author: { "@type": "Organization", name: topItem.source },
        publisher: {
          "@type": "Organization",
          name: "BVB Hub",
          url: "https://bvb-fanpage.vercel.app",
        },
        url: topItem.url,
        isPartOf: { "@type": "WebSite", name: "BVB Hub", url: "https://bvb-fanpage.vercel.app" },
      }
    : null;

  return (
    <>
      <JsonLd schema={sportsTeamSchema} />
      {newsArticleSchema && <JsonLd schema={newsArticleSchema} />}
      <Hero totalItems={items.length} updatedAt={feed.updated_at} topItems={top.slice(0, 3)} />

      <section className="mx-auto max-w-7xl px-4 mt-2">
        <TopStrip items={top} />
      </section>

      {/* Vibe Index + Tier Pulse */}
      <section className="mx-auto max-w-7xl px-4 mt-10">
        <div className="rounded-2xl bg-asphalt-900/60 border border-asphalt-700 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-bvb-yellow font-bold">Quellen-Mix</span>
              <span className="text-[10px] text-neutral-500">— {feed.items.length} Meldungen aus {Object.keys(feed.stats?.by_tier ?? {}).length || 5} Tier-Stufen</span>
            </div>
            {/* Vibe Index pill */}
            <div className="flex items-center gap-2" aria-label={`Stimmungsindex: ${vibe.score} von 100`}>
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Vibe</span>
              <span className={`text-xs font-black ${VIBE_COLORS[vibe.label]}`}>
                {vibe.score}
              </span>
              <span className="text-[10px] text-neutral-400 hidden sm:inline">
                {VIBE_DESCRIPTIONS[vibe.label]}
              </span>
            </div>
          </div>
          <div className="h-28">
            <TierPulseLazy counts={tierCounts} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 mt-10">
        <SectionHeader
          eyebrow="Live"
          title="Aktuelles"
          description="Gewichtet nach Score (Quelle × Bestätigung × Aktualität × Relevanz)."
          count={rest.length}
        />
        <CardGrid items={rest} hero />
      </section>
    </>
  );
}
