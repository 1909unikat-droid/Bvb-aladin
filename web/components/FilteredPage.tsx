import { fetchFeedServer } from "@/lib/news-server";
import { filterItems, type FilterState } from "@/lib/news";
import { CardGrid } from "./CardGrid";
import { SectionHeader } from "./SectionHeader";

interface Props {
  eyebrow: string;
  title: string;
  description?: string;
  filter: FilterState;
  emptyTitle?: string;
  emptyText?: string;
  hero?: boolean;
}

export async function FilteredPage({
  eyebrow,
  title,
  description,
  filter,
  emptyTitle,
  emptyText,
  hero = true
}: Props) {
  const feed = await fetchFeedServer();
  const items = filterItems(feed.items, filter).sort((a, b) => b.score - a.score);
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        count={items.length}
      />
      <CardGrid
        items={items}
        hero={hero}
        {...(emptyTitle ? { emptyTitle } : {})}
        {...(emptyText ? { emptyText } : {})}
      />
    </section>
  );
}
