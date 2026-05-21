"use client";

import { useState, useCallback } from "react";
import type { NewsItem } from "@/types/news";

export type SourceTrailOpener = (item: NewsItem) => void;

export function useSourceTrail() {
  const [activeItem, setActiveItem] = useState<NewsItem | null>(null);
  const open = useCallback((item: NewsItem) => setActiveItem(item), []);
  const close = useCallback(() => setActiveItem(null), []);
  return { activeItem, open, close };
}
