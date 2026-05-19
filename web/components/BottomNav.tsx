"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, ArrowRightLeft, Mic2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";

const ITEMS = [
  { href: "/", label: "Aktuelles", icon: Newspaper },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { href: "/insider", label: "Insider", icon: MoreHorizontal },
  { href: "/podcasts", label: "Podcasts", icon: Mic2 }
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-asphalt-700 bg-asphalt-950/95 backdrop-blur-md"
    >
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {ITEMS.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium relative",
                  active ? "text-bvb-yellow" : "text-neutral-400"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-pill"
                    className="absolute top-0 left-1/3 right-1/3 h-0.5 bg-bvb-yellow rounded-full"
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
