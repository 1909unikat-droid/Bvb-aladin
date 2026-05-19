"use client";
export function LiveDot() {
  return (
    <span className="relative inline-flex items-center" aria-label="Live">
      <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-bvb-yellow opacity-60 animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bvb-yellow" />
    </span>
  );
}
