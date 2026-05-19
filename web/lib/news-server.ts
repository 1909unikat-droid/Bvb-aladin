import "server-only";
import type { NewsFeed } from "@/types/news";

const PRIMARY_URL = "https://bvb-aladin.vercel.app/data/news.json";

export async function fetchFeedServer(): Promise<NewsFeed> {
  try {
    const res = await fetch(PRIMARY_URL, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as NewsFeed;
  } catch {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const file = path.join(process.cwd(), "public", "data", "news.json");
      const raw = await fs.readFile(file, "utf8");
      return JSON.parse(raw) as NewsFeed;
    } catch {
      return { updated_at: new Date().toISOString(), items: [] };
    }
  }
}
