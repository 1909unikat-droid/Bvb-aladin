import { fetchFeedServer } from "@/lib/news-server";
import { clusterItems } from "@/lib/clustering";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGrid } from "@/components/CardGrid";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const feed = await fetchFeedServer();
  const clusters = clusterItems(feed.items);
  const cluster = clusters.find((c) => c.id === id);
  if (!cluster) return { title: "Thread nicht gefunden" };
  const title = cluster.lead.title.slice(0, 60);
  return { title: `Thread: ${title}` };
}

export default async function ThreadPage({ params }: Props) {
  const { id } = await params;

  const feed = await fetchFeedServer();
  const clusters = clusterItems(feed.items);
  const cluster = clusters.find((c) => c.id === id);

  if (!cluster) notFound();

  const { lead, items, size } = cluster;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 pb-24">
      <SectionHeader
        eyebrow={`Thread · ${size} ${size === 1 ? "Quelle" : "Quellen"}`}
        title={lead.title.length > 80 ? lead.title.slice(0, 78) + "\u2026" : lead.title}
        description={`Alle zusammengehörenden Meldungen zu diesem Thema — gerankt nach Score.`}
        count={size}
      />

      <div className="mt-8">
        <CardGrid items={items} hero />
      </div>

      {/* Source trail summary */}
      <div className="mt-10 rounded-xl border border-asphalt-700 bg-asphalt-900/60 p-5">
        <p className="text-[10px] uppercase tracking-[0.3em] text-bvb-yellow font-bold mb-3">
          Quellen in diesem Thread
        </p>
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between text-xs">
              <span className="text-neutral-200 truncate max-w-[60%]">{it.source}</span>
              <span className="text-neutral-500 shrink-0">
                Score {it.score.toFixed(1)} · Tier {it.tier}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
