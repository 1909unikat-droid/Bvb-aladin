"use client";
import type { NewsFeed } from "@/types/news";

const PRIMARY_URL = "https://bvb-aladin.vercel.app/data/news.json";
const FALLBACK_URL = "/data/news.json";

export async function fetchFeedClient(): Promise<NewsFeed> {
  const res = await fetch(PRIMARY_URL, { cache: "no-store" }).catch(() => null);
  if (res && res.ok) return (await res.json()) as NewsFeed;
  const local = await fetch(FALLBACK_URL, { cache: "no-store" });
  return (await local.json()) as NewsFeed;
}
