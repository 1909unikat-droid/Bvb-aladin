"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { type SquadDef, type Player, type PositionGroup, type TeamId } from "@/lib/squad-data";
import { cn } from "@/lib/cn";
import { PlayerModal } from "./PlayerModal";

const TEAM_IDS: TeamId[] = ["profis", "u23", "u19", "amateur"];
const GROUPS: PositionGroup[] = ["Tor", "Abwehr", "Mittelfeld", "Angriff"];

function parseMarketValue(v: string | undefined): number {
  if (!v) return 0;
  const m = v.match(/([\d,]+)/);
  return m ? parseFloat((m[1] ?? "0").replace(",", ".")) : 0;
}

function totalSquadValue(players: Player[]): string {
  const total = players.reduce((s, p) => s + parseMarketValue(p.marketValue), 0);
  if (total === 0) return "—";
  return `${total.toLocaleString("de-DE")} Mio. €`;
}

function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="group relative flex items-center gap-3 rounded-xl border border-asphalt-700 bg-asphalt-900 px-4 py-3 hover:border-bvb-yellow/40 hover:bg-asphalt-800 transition-colors cursor-pointer"
    >
      {/* Jersey Number */}
      <span className="w-8 shrink-0 text-center text-xl font-black text-bvb-yellow/60 group-hover:text-bvb-yellow transition-colors">
        {player.number}
      </span>

      {/* Flag */}
      <span className="text-lg shrink-0">{player.flag}</span>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white truncate">{player.name}</span>
          {player.captain && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-bvb-yellow/20 text-bvb-yellow font-bold">C</span>
          )}
          {player.onLoan && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">Leihe</span>
          )}
        </div>
        <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
          <span className="font-mono text-neutral-400">{player.positionShort}</span>
          <span>·</span>
          <span>{player.age} J.</span>
          {player.contract && (
            <>
              <span>·</span>
              <span>bis {player.contract}</span>
            </>
          )}
          {player.onLoan && player.loanFrom && (
            <>
              <span>·</span>
              <span className="text-blue-400">von {player.loanFrom}</span>
            </>
          )}
        </div>
      </div>

      {/* Market value */}
      {player.marketValue && (
        <div className="text-right shrink-0">
          <span className="text-sm font-semibold text-bvb-yellow">{player.marketValue}</span>
          <div className="text-xs text-neutral-600">TM-Wert</div>
        </div>
      )}
    </motion.div>
  );
}

const SEASONS = [
  { id: "2025", label: "Saison 2025/26" },
  { id: "2026", label: "Saison 2026/27" },
];

export function KaderClient({ squads, season, pending = false }: { squads: SquadDef[]; season: string; pending?: boolean }) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamId = (searchParams.get("team") ?? "profis") as TeamId;
  const squad = squads.find((s) => s.id === teamId) ?? squads[0]!;
  const squadValue = squad.squadValue || totalSquadValue(squad.players);

  const handleTeam = (id: TeamId) => {
    router.push(`/kader?team=${id}&season=${season}`, { scroll: false });
  };
  const handleSeason = (s: string) => {
    router.push(`/kader?team=${teamId}&season=${s}`, { scroll: false });
  };

  const seasonLabel = SEASONS.find((s) => s.id === season)?.label ?? `Saison ${season}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-white">Kader</h1>
          <p className="text-neutral-400 mt-1">Borussia Dortmund — {seasonLabel}</p>
        </div>
        {/* Season dropdown */}
        <div className="relative">
          <select
            value={season}
            onChange={(e) => handleSeason(e.target.value)}
            className="appearance-none bg-asphalt-800 border border-asphalt-700 text-neutral-300 text-sm font-medium rounded-full px-4 py-2 pr-8 cursor-pointer hover:border-bvb-yellow/40 focus:outline-none focus:border-bvb-yellow transition-colors"
          >
            {SEASONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">▾</span>
        </div>
      </div>

      {/* Team selector */}
      <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-1">
        {squads.map((s) => (
          <button
            key={s.id}
            onClick={() => handleTeam(s.id)}
            className={cn(
              "relative px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
              teamId === s.id
                ? "bg-bvb-yellow text-black"
                : "bg-asphalt-800 text-neutral-300 hover:bg-asphalt-700 hover:text-white border border-asphalt-700"
            )}
          >
            {s.label}
            <span className="ml-1.5 text-xs opacity-70">{s.league}</span>
          </button>
        ))}
      </div>

      {/* Pending notice for future season */}
      {pending && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-neutral-700 bg-neutral-900/60 px-5 py-3 flex items-center gap-3 text-sm"
        >
          <span className="text-xl">🔄</span>
          <div>
            <span className="text-neutral-300 font-medium">Kader 2026/27 noch nicht veröffentlicht</span>
            <span className="text-neutral-500 ml-2">— aktuell Saison 2025/26 als Vorschau</span>
          </div>
        </motion.div>
      )}

      {/* Squad value banner (Profis only) */}
      {teamId === "profis" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-bvb-yellow/20 bg-bvb-yellow/5 px-6 py-4 flex items-center justify-between"
        >
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Gesamtkaderwert (Transfermarkt)</div>
            <div className="text-2xl font-black text-bvb-yellow">{squadValue}</div>
          </div>
          <div className="text-right text-xs text-neutral-600">
            <div>{squad.players.filter((p) => p.marketValue).length} Spieler mit TM-Wert</div>
            <div className="mt-0.5">Quelle: transfermarkt.de</div>
          </div>
        </motion.div>
      )}

      {/* Players grouped by position */}
      <AnimatePresence mode="wait">
        <motion.div
          key={teamId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-8"
        >
          {GROUPS.map((group) => {
            const players = squad.players.filter((p) => p.positionGroup === group);
            if (players.length === 0) return null;
            return (
              <section key={group}>
                <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-3">
                  <span>{group}</span>
                  <span className="flex-1 border-t border-asphalt-700" />
                  <span className="text-neutral-600">{players.length}</span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {players.map((p) => (
                    <PlayerCard key={p.id} player={p} onClick={() => setSelectedPlayer(p)} />
                  ))}
                </div>
              </section>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <p className="mt-10 text-xs text-neutral-700 text-center">
        Kaderdaten manuell gepflegt · Marktwerte laut transfermarkt.de · Keine Gewähr auf Aktualität
      </p>

      <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </main>
  );
}
