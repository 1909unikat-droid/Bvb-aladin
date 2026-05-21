"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DropdownChild {
  href: string;
  label: string;
}

interface Props {
  href: string;
  label: string;
  children: DropdownChild[];
}

export function NavDropdown({ href, label, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = pathname.startsWith(href);

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };
  const hide = () => {
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <Link
        href={href}
        className={cn(
          "relative flex items-center gap-0.5 px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
          isActive ? "text-black" : "text-neutral-300 hover:text-white"
        )}
      >
        {isActive && (
          <motion.span
            layoutId="nav-pill"
            className="absolute inset-0 rounded-full bg-bvb-yellow"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}
        <span className="relative">{label}</span>
        <ChevronDown
          size={12}
          className={cn("relative transition-transform duration-150", open && "rotate-180")}
        />
      </Link>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 min-w-[140px] rounded-xl border border-asphalt-700 bg-asphalt-900/95 backdrop-blur-md shadow-2xl overflow-hidden z-50"
          >
            {children.map((child) => {
              const childActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "block px-4 py-2.5 text-sm font-medium transition-colors hover:bg-asphalt-700",
                    childActive
                      ? "text-bvb-yellow bg-asphalt-800"
                      : "text-neutral-300 hover:text-white"
                  )}
                  onClick={() => setOpen(false)}
                >
                  {child.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
