import { fetchFeedServer } from "@/lib/news-server";
import { Hero } from "@/components/Hero";
import { CardGrid } from "@/components/CardGrid";
import { SectionHeader } from "@/components/SectionHeader";
import { TopStrip } from "@/components/TopStrip";

export const revalidate = 60;

export default async function HomePage() {
  const feed = await fetchFeedServer();
  const items = [...feed.items].sort((a, b) => b.score - a.score);
  const top = items.slice(0, 8);
  const rest = items.slice(0, 60);

  return (
    <>
      <Hero totalItems={items.length} updatedAt={feed.updated_at} />

      <section className="mx-auto max-w-7xl px-4 mt-2">
        <TopStrip items={top} />
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
