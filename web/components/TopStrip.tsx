"use client";
import type { NewsItem } from "@/types/news";
import { Card } from "./Card";

export function TopStrip({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="-mx-4 px-4">
      <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-[0.25em] text-neutral-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-bvb-yellow" />
        Top-Stories
      </div>
      <div
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
        role="list"
        aria-label="Top-Stories horizontal scrollen"
      >
        {items.map((it, i) => (
          <div key={it.id} role="listitem">
            <Card item={it} variant="compact" index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
