"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/lib/squad-data";

const tmProfile = (tmId: number) =>
  `https://www.transfermarkt.de/spieler/profil/spieler/${tmId}`;

const tmCdn = (tmId: number) =>
  `https://img.a.transfermarkt.technology/portrait/big/${tmId}.jpg`;

function useResolvedPhotoUrl(tmId: number | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!tmId) return;
    setUrl(null);
    fetch(`/api/tm-photo?id=${tmId}&url=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { setUrl(data?.url ?? tmCdn(tmId)); })
      .catch(() => { setUrl(tmCdn(tmId)); });
  }, [tmId]);
  return url;
}

export function PlayerModal({
  player,
  onClose,
}: {
  player: Player | null;
  onClose: () => void;
}) {
  const photoUrl = useResolvedPhotoUrl(player?.tmId);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [player?.tmId]);

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
                {photoUrl && !imgFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={player.name}
                    onError={() => setImgFailed(true)}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 80 110" fill="none" xmlns="http://www.w3.org/2000/svg"
                      className="w-28 h-28 opacity-[0.18] text-bvb-yellow" aria-hidden>
                      <circle cx="40" cy="18" r="14" fill="currentColor"/>
                      <path d="M18 44 C20 36 28 32 40 32 C52 32 60 36 62 44 L68 84 L52 84 L50 62 L30 62 L28 84 L12 84 Z" fill="currentColor"/>
                      <path d="M18 44 L6 70 L16 73 L26 50 Z" fill="currentColor"/>
                      <path d="M62 44 L74 70 L64 73 L54 50 Z" fill="currentColor"/>
                      <rect x="26" y="84" width="12" height="22" rx="3" fill="currentColor"/>
                      <rect x="42" y="84" width="12" height="22" rx="3" fill="currentColor"/>
                    </svg>
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
