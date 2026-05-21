import { fetchFeedServer } from "@/lib/news-server";
import { composeBriefing, briefingDateLabel } from "@/lib/briefing";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGrid } from "@/components/CardGrid";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 60;

interface Props {
  params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  return { title: `Briefing ${date}` };
}

export default async function BriefingPage({ params }: Props) {
  const { date } = await params;

  // Validate: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const feed = await fetchFeedServer();
  const refDate = new Date(date + "T12:00:00.000Z");
  if (isNaN(refDate.getTime())) notFound();

  const briefing = composeBriefing(feed.items, refDate);
  const dateLabel = briefingDateLabel(date);

  if (briefing.totalItems === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-24">
        <SectionHeader
          eyebrow={dateLabel}
          title="Briefing"
          description="Für diesen Tag liegen keine Meldungen im Feed vor."
          count={0}
        />
      </section>
    );
  }

  const allItems = briefing.sections.flatMap((s) => s.items);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 pb-24">
      <SectionHeader
        eyebrow={dateLabel}
        title="09:09 Briefing"
        description={briefing.headline}
        count={briefing.totalItems}
      />

      {briefing.sections.map((section) => (
        <div key={section.category} className="mt-10">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-bvb-yellow font-bold mb-4">
            {section.label}
          </h2>
          <CardGrid items={section.items} hero={section.category === briefing.sections[0]?.category} />
        </div>
      ))}

      {allItems.length === 0 && (
        <p className="text-neutral-500 mt-8">Keine Meldungen für dieses Briefing.</p>
      )}
    </section>
  );
}
