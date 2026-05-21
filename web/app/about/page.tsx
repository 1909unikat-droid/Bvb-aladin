import type { Metadata } from "next";
import { fetchFeedServer } from "@/lib/news-server";
import type { Tier } from "@/types/news";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Über den BVB Hub",
  description: "Transparenz über Quellen, Score-System und Methodik des BVB Hub.",
};

const TIER_INFO: Record<Tier, { label: string; desc: string }> = {
  1: {
    label: "Tier 1 — Insider-Journalisten",
    desc: "Romano, Plettenberg, Berger u.a. — höchste Glaubwürdigkeit, direkte Vereinskontakte.",
  },
  2: {
    label: "Tier 2 — Etablierte Medien",
    desc: "kicker, Ruhr Nachrichten, RUHR24, Sport1 — redaktionell geprüfte Berichte.",
  },
  3: {
    label: "Tier 3 — Offizielle BVB-Kanäle",
    desc: "@BVB, bvb.de — Vereins-Pressemitteilungen und offizielle Statements.",
  },
  4: {
    label: "Tier 4 — Fan-Medien",
    desc: "Schwatzgelb, 90min, FanreporterBVB — fan-nahe Berichterstattung.",
  },
  5: {
    label: "Tier 5 — Social / Sonstige",
    desc: "Twitter-Threads, YouTube-Reaktionen, Podcasts — breites Community-Rauschen.",
  },
};

const SCORE_AXES = [
  { key: "credibility", label: "Quellen-Glaubwürdigkeit", weight: "35 %", desc: "Tier-basierter Vertrauenswert der primären Quelle." },
  { key: "confirmation", label: "Mehrfach-Bestätigung", weight: "25 %", desc: "Wie viele unabhängige Quellen dieselbe Meldung berichten." },
  { key: "recency", label: "Aktualität", weight: "20 %", desc: "Exponentieller Decay — Meldungen verlieren mit der Zeit an Gewicht." },
  { key: "specificity", label: "Konkretheit", weight: "10 %", desc: "Enthält die Meldung Namen, Zahlen, Daten?" },
  { key: "relevance", label: "BVB-Bezug", weight: "10 %", desc: "Direkter Bezug zu Borussia Dortmund, Spielern oder Vereinsgeschehen." },
];

export default async function AboutPage() {
  const feed = await fetchFeedServer();
  const sourceMap = new Map<string, { name: string; tier: Tier; count: number }>();

  for (const item of feed.items) {
    const entry = sourceMap.get(item.source_id);
    if (entry) {
      entry.count++;
    } else {
      sourceMap.set(item.source_id, { name: item.source, tier: item.tier, count: 1 });
    }
  }

  const sources = Array.from(sourceMap.values()).sort((a, b) => a.tier - b.tier || b.count - a.count);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 space-y-16">
      {/* Intro */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.3em] text-bvb-yellow font-bold mb-3">BVB Hub</p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Quellen &amp; Methodik</h1>
        <p className="text-neutral-300 leading-relaxed max-w-2xl">
          Der BVB Hub ist ein unabhängiges Fan-Projekt. Wir aggregieren automatisch Meldungen
          aus {sources.length}+ Quellen und gewichten sie nach einem transparenten Score-System —
          kein Redakteur, kein Algorithmus, der dich süchtig machen will. Nur Signal.
        </p>
      </section>

      {/* Score system */}
      <section>
        <h2 className="text-xl font-bold mb-6 border-b border-asphalt-700 pb-3">
          Score-System (0 – 10)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SCORE_AXES.map((ax) => (
            <div key={ax.key} className="rounded-xl border border-asphalt-700 bg-asphalt-900/60 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-neutral-100">{ax.label}</span>
                <span className="text-xs text-bvb-yellow font-mono font-bold">{ax.weight}</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{ax.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tier system */}
      <section>
        <h2 className="text-xl font-bold mb-6 border-b border-asphalt-700 pb-3">
          Tier-System
        </h2>
        <div className="flex flex-col gap-4">
          {(Object.entries(TIER_INFO) as [string, { label: string; desc: string }][]).map(([tier, info]) => (
            <div key={tier} className="flex gap-4 items-start rounded-xl border border-asphalt-700 bg-asphalt-900/60 p-4">
              <span className="shrink-0 w-8 h-8 rounded-full bg-bvb-yellow/10 border border-bvb-yellow/30 flex items-center justify-center text-xs font-black text-bvb-yellow">
                {tier}
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-100">{info.label}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{info.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live source list */}
      <section>
        <h2 className="text-xl font-bold mb-2 border-b border-asphalt-700 pb-3">
          Aktive Quellen ({sources.length})
        </h2>
        <p className="text-xs text-neutral-500 mb-6">
          Basierend auf dem aktuellen Feed-Snapshot vom{" "}
          {new Date(feed.updated_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} Uhr.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((src) => (
            <div
              key={src.name + src.tier}
              className="flex items-center justify-between rounded-lg border border-asphalt-700 bg-asphalt-900/40 px-3 py-2"
            >
              <span className="text-sm text-neutral-200 truncate">{src.name}</span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-[10px] text-neutral-500">{src.count}×</span>
                <span className="text-[10px] font-bold text-bvb-yellow/80 border border-bvb-yellow/30 rounded px-1">
                  T{src.tier}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="border-t border-asphalt-700 pt-8">
        <p className="text-xs text-neutral-500 leading-relaxed">
          BVB Hub ist kein offizielles Angebot von Borussia Dortmund GmbH &amp; Co. KGaA.
          Alle Inhalte werden automatisiert aus öffentlichen Quellen aggregiert.
          Für die Richtigkeit der Inhalte können wir keine Gewähr übernehmen.
          Markenrechte an Logo, Trikot und Vereinsnamen liegen beim BVB.
        </p>
      </section>
    </div>
  );
}
