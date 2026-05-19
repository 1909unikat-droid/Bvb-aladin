"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { LiveDot } from "@/components/LiveDot";
import { RefreshButton } from "@/components/RefreshButton";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-asphalt-950/85 backdrop-blur-md border-b border-asphalt-700"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 group" aria-label="BVB Hub Startseite">
          <Wordmark scrolled={scrolled} />
          <LiveDot />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Hauptnavigation">
          {ROUTES.map((r) => {
            const active = pathname === r.href;
            return (
              <Link
                key={r.href}
                href={r.href}
                className={cn(
                  "relative px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                  active ? "text-black" : "text-neutral-300 hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-bvb-yellow"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{r.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <RefreshButton />
        </div>
      </div>
    </header>
  );
}

function Wordmark({ scrolled }: { scrolled: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "h-7 w-7 rounded-md grid place-items-center bg-bvb-yellow text-black font-black tracking-tighter transition-all",
          scrolled ? "scale-90" : "scale-100"
        )}
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span className="text-[15px] leading-none">09</span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-bvb-yellow font-black tracking-wider text-sm">BVB</span>
        <span className="text-neutral-400 text-[10px] tracking-[0.2em] uppercase">Hub</span>
      </div>
    </div>
  );
}
