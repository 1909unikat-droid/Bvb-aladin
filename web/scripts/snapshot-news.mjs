#!/usr/bin/env node
// Pulls a fresh news.json snapshot into /public/data for offline/build fallback.
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const URL = "https://bvb-aladin.vercel.app/data/news.json";
const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "public", "data", "news.json");

const res = await fetch(URL);
if (!res.ok) {
  console.error(`Snapshot failed: HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(data, null, 2));
console.log(`Snapshot saved: ${out} — ${data.items?.length ?? 0} items, updated_at=${data.updated_at}`);
