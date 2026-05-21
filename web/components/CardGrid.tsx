"use client";
import { useMemo } from "react";
import type { NewsItem } from "@/types/news";
import { Card } from "./Card";
import { Newspaper } from "lucide-react";
import { useSourceTrail } from "@/lib/use-source-trail";
import { SourceTrailModal } from "@/components/modals/SourceTrailModal";
import { clusterItems } from "@/lib/clustering";

interface Props {
  items: NewsItem[];
  hero?: boolean;
  emptyTitle?: string;
  emptyText?: string;
}

export function CardGrid({ items, hero = true, emptyTitle, emptyText }: Props) {
  const { activeItem, open, close } = useSourceTrail();

  // Build a map: itemId → { size, clusterId }
  const clusterMap = useMemo(() => {
    const clusters = clusterItems(items);
    const map = new Map<string, { size: number; clusterId: string }>();
    for (const c of clusters) {
      for (const it of c.items) {
        map.set(it.id, { size: c.size, clusterId: c.id });
      }
    }
    return map;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-asphalt-600 p-10 text-center">
        <Newspaper className="mx-auto h-10 w-10 text-bvb-yellow opacity-60 mb-3" aria-hidden />
        <h3 className="text-lg font-bold">{emptyTitle ?? "Aktuell nichts Neues"}</h3>
        <p className="text-sm text-neutral-400 mt-1">
          {emptyText ?? "Schau später wieder vorbei — wir lesen alle 30 Min nach."}
        </p>
      </div>
    );
  }

  const [first, ...rest] = items;
  const showHero = hero && first && first.score >= 6.0;

  return (
    <>
      <div className="space-y-6">
        {showHero && first && (
          <Card
            item={first}
            variant="hero"
            index={0}
            onSourceTrail={open}
            clusterSize={clusterMap.get(first.id)?.size}
            clusterId={clusterMap.get(first.id)?.clusterId}
          />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(showHero ? rest : items).map((it, i) => (
            <Card
              key={it.id}
              item={it}
              index={i}
              onSourceTrail={open}
              clusterSize={clusterMap.get(it.id)?.size}
              clusterId={clusterMap.get(it.id)?.clusterId}
            />
          ))}
        </div>
      </div>
      <SourceTrailModal item={activeItem} onClose={close} />
    </>
  );
}
