"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { Fixture, Competition } from "@/lib/fixtures";

const COMPETITION_LABELS: Record<Competition, string> = {
  bundesliga: "Bundesliga",
  "champions-league": "Champions League",
  "dfb-pokal": "DFB-Pokal",
  freundschaft: "Freundschaft",
};

const COMPETITION_COLORS: Record<Competition, string> = {
  bundesliga: "text-red-400 bg-red-400/10 border-red-400/20",
  "champions-league": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "dfb-pokal": "text-green-400 bg-green-400/10 border-green-400/20",
  freundschaft: "text-neutral-400 bg-neutral-400/10 border-neutral-400/20",
};

type Filter = "alle" | Competition;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

function ScoreBadge({ fixture }: { fixture: Fixture }) {
  if (!fixture.isFinished || !fixture.score) {
    return (
      <span className="text-xs text-neutral-500 tabular-nums">
        {formatTime(fixture.dateTime)}
      </span>
    );
  }
  const { home, away } = fixture.score;
  const bvbWon = fixture.isBVBHome ? home > away : away > home;
  const draw = home === away;
  return (
    <span
      className={cn(
        "px-3 py-1 rounded-lg font-black text-base tabular-nums",
        draw ? "text-neutral-400" : bvbWon ? "text-bvb-yellow" : "text-red-400"
      )}
    >
      {fixture.isBVBHome ? `${home}:${away}` : `${away}:${home}`}
    </span>
  );
}

function FixtureRow({ fixture }: { fixture: Fixture }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 rounded-xl border border-asphalt-700 bg-asphalt-900 px-4 py-3 hover:border-asphalt-600 transition-colors"
    >
      {/* Date */}
      <div className="shrink-0 text-center w-20">
        <div className="text-xs font-semibold text-white tabular-nums">{formatDate(fixture.dateTime)}</div>
        {!fixture.isFinished && (
          <div className="text-xs text-neutral-500">{formatTime(fixture.dateTime)}</div>
        )}
      </div>

      {/* Competition badge */}
      <span className={cn("shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium hidden sm:inline-block", COMPETITION_COLORS[fixture.competition])}>
        {fixture.matchday ?? COMPETITION_LABELS[fixture.competition]}
      </span>

      {/* Match */}
      <div className="flex-1 min-w-0 font-semibold text-sm">
        <span className={fixture.isBVBHome ? "text-bvb-yellow" : "text-white"}>{fixture.homeTeam}</span>
        <span className="text-neutral-600 mx-2">vs</span>
        <span className={!fixture.isBVBHome ? "text-bvb-yellow" : "text-white"}>{fixture.awayTeam}</span>
      </div>

      {/* Score / time */}
      <div className="shrink-0">
        <ScoreBadge fixture={fixture} />
      </div>

      {/* Finished badge */}
      {fixture.isFinished && (
        <span className="shrink-0 text-xs text-neutral-600 hidden lg:block">Abpfiff</span>
      )}
    </motion.div>
  );
}

// Static training entries
const TRAINING_EVENTS = [
  { date: "2026-06-17", label: "Trainingsauftakt Profis", type: "training" },
  { date: "2026-06-20", label: "Öffentliches Training (Stadion)", type: "public" },
  { date: "2026-07-01", label: "Trainingslager (Ort TBD)", type: "camp" },
  { date: "2026-07-14", label: "Öffentliches Training (Trainingszentrum)", type: "public" },
  { date: "2026-08-01", label: "Saisonvorbereitung Phase 2", type: "training" },
];

const TRAINING_TYPE_COLORS: Record<string, string> = {
  training: "bg-asphalt-700 text-neutral-300",
  public: "bg-bvb-yellow/20 text-bvb-yellow border border-bvb-yellow/30",
  camp: "bg-purple-500/15 text-purple-300 border border-purple-500/25",
};

const TRAINING_TYPE_LABELS: Record<string, string> = {
  training: "Training",
  public: "Öff. Training",
  camp: "Trainingslager",
};

export function TermineClient({ fixtures }: { fixtures: Fixture[] }) {
  const [filter, setFilter] = useState<Filter>("alle");

  const competitions: Competition[] = ["bundesliga", "champions-league", "dfb-pokal"];

  const filtered = filter === "alle"
    ? fixtures
    : fixtures.filter((f) => f.competition === filter);

  const upcoming = filtered.filter((f) => !f.isFinished);
  const finished = filtered.filter((f) => f.isFinished);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Termine</h1>
        <p className="text-neutral-400 mt-1">Spielplan, Trainingslager & öffentliche Events</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-1">
        {(["alle", ...competitions] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              filter === f
                ? "bg-bvb-yellow text-black"
                : "bg-asphalt-800 text-neutral-400 hover:text-white border border-asphalt-700"
            )}
          >
            {f === "alle" ? "Alle" : COMPETITION_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-3">
            <span>Kommende Spiele</span>
            <span className="flex-1 border-t border-asphalt-700" />
          </h2>
          <div className="space-y-2">
            {upcoming.map((f) => <FixtureRow key={f.id} fixture={f} />)}
          </div>
        </section>
      )}

      {/* Training & Events (shown when filter = "alle") */}
      {filter === "alle" && (
        <section className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-3">
            <span>Training & Events</span>
            <span className="flex-1 border-t border-asphalt-700" />
          </h2>
          <div className="space-y-2">
            {TRAINING_EVENTS.map((ev) => (
              <div
                key={ev.date + ev.label}
                className="flex items-center gap-3 rounded-xl border border-asphalt-700 bg-asphalt-900 px-4 py-3"
              >
                <div className="w-20 shrink-0 text-xs font-semibold text-white tabular-nums">
                  {new Date(ev.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </div>
                <span className={cn("shrink-0 text-xs px-2 py-0.5 rounded-full font-medium", TRAINING_TYPE_COLORS[ev.type])}>
                  {TRAINING_TYPE_LABELS[ev.type]}
                </span>
                <span className="text-sm text-neutral-300">{ev.label}</span>
                {ev.type === "public" && (
                  <span className="ml-auto text-xs text-bvb-yellow/70">Fans willkommen</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-700">Termindaten sind vorläufig · Änderungen vorbehalten</p>
        </section>
      )}

      {/* Results */}
      {finished.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-3">
            <span>Ergebnisse</span>
            <span className="flex-1 border-t border-asphalt-700" />
            <span className="text-neutral-600">{finished.length}</span>
          </h2>
          <div className="space-y-2">
            {[...finished].reverse().map((f) => <FixtureRow key={f.id} fixture={f} />)}
          </div>
        </section>
      )}
    </main>
  );
}
