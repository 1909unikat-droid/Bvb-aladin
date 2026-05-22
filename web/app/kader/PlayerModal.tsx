"use client";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/lib/squad-data";

const tmPhoto = (tmId: number) =>
  `https://tmssl.akamaized.net/portrait/big/${tmId}.jpg`;
const tmProfile = (tmId: number) =>
  `https://www.transfermarkt.de/spieler/profil/spieler/${tmId}`;

export function PlayerModal({
  player,
  onClose,
}: {
  player: Player | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {player && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto relative w-full max-w-md rounded-2xl border border-asphalt-700 bg-asphalt-900 overflow-hidden shadow-2xl"
            >
              {/* Close */}
              <button
                onClick={onClose}
                aria-label="Schließen"
                className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-neutral-300 hover:text-white hover:bg-black/80 transition-colors text-sm"
              >
                ✕
              </button>

              {/* Photo */}
              <div className="relative h-56 bg-asphalt-800 flex items-end">
                {player.tmId ? (
                  <Image
                    src={tmPhoto(player.tmId)}
                    alt={player.name}
                    fill
                    className="object-cover object-top"
                    sizes="448px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-30">
                    {player.flag}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-asphalt-900 via-asphalt-900/20 to-transparent" />
                <div className="relative px-5 pb-4 w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-3xl font-black text-bvb-yellow">#{player.number}</span>
                    {player.captain && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-bvb-yellow/20 text-bvb-yellow font-bold">C</span>
                    )}
                    {player.onLoan && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">Leihe</span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-white leading-tight">{player.name}</h2>
                  <p className="text-sm text-neutral-400 mt-0.5">
                    {player.positionDetail || player.positionShort} &middot; {player.flag} {player.nationality}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-px bg-asphalt-700 border-t border-asphalt-700">
                {[
                  { label: "Alter", value: `${player.age} Jahre` },
                  { label: "Im Verein seit", value: player.since > 0 ? String(player.since) : "—" },
                  { label: "Vertrag bis", value: player.contract || "—" },
                  { label: "Marktwert", value: player.marketValue || "—", highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="bg-asphalt-900 px-5 py-3">
                    <div className="text-xs text-neutral-500 mb-0.5">{label}</div>
                    <div className={`text-sm font-semibold ${highlight ? "text-bvb-yellow" : "text-white"}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Loan */}
              {player.onLoan && player.loanFrom && (
                <div className="px-5 py-3 border-t border-asphalt-700 text-sm text-blue-400">
                  Leihspieler von <span className="font-semibold">{player.loanFrom}</span>
                </div>
              )}

              {/* TM link */}
              {player.tmId && (
                <div className="px-5 py-4 border-t border-asphalt-700">
                  <a
                    href={tmProfile(player.tmId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full rounded-xl bg-asphalt-800 hover:bg-asphalt-700 px-4 py-3 text-sm font-semibold text-white transition-colors group"
                  >
                    <span>Profil auf Transfermarkt</span>
                    <span className="text-bvb-yellow group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
