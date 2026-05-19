import type { MetadataRoute } from "next";
import { ROUTES } from "@/lib/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = "https://bvb-fanpage.vercel.app";
  return ROUTES.map((r) => ({
    url: base + r.href,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: r.href === "/" ? 1 : 0.7
  }));
}
