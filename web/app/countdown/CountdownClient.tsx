"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface CountdownTarget {
  id: string;
  label: string;
  sublabel: string;
  target: Date;
  color: "yellow" | "red" | "blue" | "green" | "purple";
  icon: string;
  expired?: string; // label to show when elapsed
}

const TARGETS: CountdownTarget[] = [
  {
    id: "sommer-transferfenster",
    label: "Sommer-Transferfenster",
    sublabel: "Schließt am 31. August 2026",
    target: new Date("2026-08-31T23:59:00+02:00"),
    color: "yellow",
    icon: "⚡",
    expired: "Fenster geschlossen",
  },
  {
    id: "deadline-day-sommer",
    label: "Deadline Day",
    sublabel: "31. August 2026 — letzter Tag",
    target: new Date("2026-08-31T18:00:00+02:00"),
    color: "red",
    icon: "🔥",
    expired: "Deadline vorbei",
  },
  {
    id: "saisonstart",
    label: "Saisonstart 2026/27",
    sublabel: "Bundesliga — 1. Spieltag (ca. 9. August 2026)",
    target: new Date("2026-08-09T15:30:00+02:00"),
    color: "green",
    icon: "🟡",
    expired: "Saison läuft",
  },
  {
    id: "winter-transferfenster",
    label: "Winter-Transferfenster",
    sublabel: "Öffnet 1. Januar 2027 · Deadline 31. Januar 2027",
    target: new Date("2027-01-31T23:59:00+01:00"),
    color: "blue",
    icon: "❄️",
    expired: "Fenster geschlossen",
  },
  {
    id: "em-2028",
    label: "EURO 2028",
    sublabel: "Beginn in UK/Irland",
    target: new Date("2028-06-14T21:00:00+01:00"),
    color: "purple",
    icon: "🏆",
    expired: "Turnier läuft",
  },
];

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcTimeLeft(target: Date): TimeLeft {
  const total = target.getTime() - Date.now();
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total };
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((total % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, total };
}

const COLOR_MAP = {
  yellow: {
    border: "border-bvb-yellow/30",
    bg: "bg-bvb-yellow/5",
    accent: "text-bvb-yellow",
    digit: "bg-bvb-yellow/10 border-bvb-yellow/20 text-bvb-yellow",
    label: "text-bvb-yellow/70",
  },
  red: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    accent: "text-red-400",
    digit: "bg-red-500/10 border-red-500/20 text-red-400",
    label: "text-red-400/70",
  },
  blue: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    accent: "text-blue-400",
    digit: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    label: "text-blue-400/70",
  },
  green: {
    border: "border-green-500/30",
    bg: "bg-green-500/5",
    accent: "text-green-400",
    digit: "bg-green-500/10 border-green-500/20 text-green-400",
    label: "text-green-400/70",
  },
  purple: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/5",
    accent: "text-purple-400",
    digit: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    label: "text-purple-400/70",
  },
};

function DigitBlock({ value, label, colors }: { value: number; label: string; colors: typeof COLOR_MAP.yellow }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        key={value}
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "w-16 h-16 md:w-20 md:h-20 rounded-xl border flex items-center justify-center",
          "text-2xl md:text-3xl font-black tabular-nums",
          colors.digit
        )}
      >
        {String(value).padStart(2, "0")}
      </motion.div>
      <span className={cn("text-xs font-medium uppercase tracking-wide", colors.label)}>{label}</span>
    </div>
  );
}

function CountdownCard({ item }: { item: CountdownTarget }) {
  const [tl, setTl] = useState<TimeLeft>(() => calcTimeLeft(item.target));
  const colors = COLOR_MAP[item.color];
  const expired = tl.total <= 0;

  useEffect(() => {
    const id = setInterval(() => setTl(calcTimeLeft(item.target)), 1000);
    return () => clearInterval(id);
  }, [item.target]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-2xl border p-6 md:p-8",
        colors.border,
        colors.bg
      )}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-2xl mb-1">{item.icon}</div>
          <h2 className={cn("text-lg font-black", colors.accent)}>{item.label}</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{item.sublabel}</p>
        </div>
        {expired && (
          <span className={cn("text-xs font-semibold px-3 py-1 rounded-full border", colors.digit)}>
            {item.expired}
          </span>
        )}
      </div>

      {expired ? (
        <div className={cn("text-4xl font-black text-center py-4", colors.accent)}>00:00:00:00</div>
      ) : (
        <div className="flex items-center justify-center gap-3 md:gap-5">
          <DigitBlock value={tl.days}    label="Tage"    colors={colors} />
          <span className={cn("text-2xl font-black pb-5", colors.accent)}>:</span>
          <DigitBlock value={tl.hours}   label="Stunden" colors={colors} />
          <span className={cn("text-2xl font-black pb-5", colors.accent)}>:</span>
          <DigitBlock value={tl.minutes} label="Minuten" colors={colors} />
          <span className={cn("text-2xl font-black pb-5", colors.accent)}>:</span>
          <DigitBlock value={tl.seconds} label="Sekunden" colors={colors} />
        </div>
      )}
    </motion.div>
  );
}

export function CountdownClient() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white">Timer</h1>
        <p className="text-neutral-400 mt-1">Transferfenster · Deadline Day · Saisonstart · Vorverkauf</p>
      </div>

      <div className="space-y-5">
        {TARGETS.map((t) => (
          <CountdownCard key={t.id} item={t} />
        ))}
      </div>

      <p className="mt-10 text-xs text-neutral-700 text-center">
        Termine ohne Gewähr · Saisonstart ca. basierend auf DFL-Planungen · Zeiten in MESZ/MEZ
      </p>
    </main>
  );
}
