"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { LiveDot } from "@/components/LiveDot";
import { RefreshButton } from "@/components/RefreshButton";
import { Wordmark09 } from "@/components/ui/Wordmark09";
import { NavDropdown } from "@/components/nav/NavDropdown";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Magnetic nav: shift active pill slightly toward cursor
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onMove = (e: MouseEvent) => {
      const links = nav.querySelectorAll<HTMLAnchorElement>("a");
      links.forEach((link) => {
        const r = link.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) / r.width;
        const dy = (e.clientY - cy) / r.height;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1.2) {
          const strength = (1 - dist) * 5;
          link.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
        } else {
          link.style.transform = "";
        }
      });
    };
    const onLeave = () => {
      nav.querySelectorAll<HTMLAnchorElement>("a").forEach((l) => (l.style.transform = ""));
    };
    nav.addEventListener("mousemove", onMove);
    nav.addEventListener("mouseleave", onLeave);
    return () => {
      nav.removeEventListener("mousemove", onMove);
      nav.removeEventListener("mouseleave", onLeave);
    };
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
      <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 group shrink-0" aria-label="BVB Hub Startseite">
          <Wordmark09 scrolled={scrolled} />
          <LiveDot />
        </Link>

        <nav
          ref={navRef}
          className="hidden md:flex items-center gap-0.5 ml-2 overflow-x-auto scrollbar-hide"
          aria-label="Hauptnavigation"
        >
          {ROUTES.map((r) => {
            if (r.children) {
              return (
                <NavDropdown
                  key={r.href}
                  href={r.href}
                  label={r.label}
                  children={r.children}
                />
              );
            }
            const active = pathname === r.href;
            return (
              <Link
                key={r.href}
                href={r.href}
                className={cn(
                  "relative px-2.5 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
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

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <RefreshButton />
        </div>
      </div>
    </header>
  );
}
