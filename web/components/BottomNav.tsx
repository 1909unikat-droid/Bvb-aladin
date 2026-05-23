"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, ArrowRightLeft, Users, CalendarDays, MoreHorizontal, Mic2, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";

const ITEMS = [
  { href: "/", label: "Aktuelles", icon: Newspaper },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { href: "/kader", label: "Kader", icon: Users },
  { href: "/podcasts", label: "Podcasts", icon: Mic2 },
  { href: "/videos", label: "Videos", icon: Play },
  { href: "/termine", label: "Termine", icon: CalendarDays },
  { href: "/insider", label: "Insider", icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-asphalt-700 bg-asphalt-950/95 backdrop-blur-md"
    >
      <ul className="flex overflow-x-auto scrollbar-hide">
        {ITEMS.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          return (
            <li key={it.href} className="flex-shrink-0">
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 px-4 min-w-[64px] text-[11px] font-medium relative",
                  active ? "text-bvb-yellow" : "text-neutral-400"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-pill"
                    className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-bvb-yellow rounded-full"
                  />
                )}
                <Icon className="h-5 w-5" aria-hidden />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
