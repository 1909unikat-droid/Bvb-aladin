"use client";

import dynamic from "next/dynamic";
import { canUse3D } from "@/lib/motion-flags";
import { useEffect, useState } from "react";

const StadiumWireframe3D = dynamic(() => import("./StadiumWireframe3D"), {
  ssr: false,
  loading: () => <StadiumFallback />,
});

function StadiumFallback() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-center justify-center opacity-30"
    >
      {/* CSS ellipse — fallback for low-end / no-WebGL */}
      <div
        className="w-48 h-28 rounded-full border-2 border-bvb-yellow/60 glow-yellow"
        style={{ transform: "rotateX(55deg)" }}
      />
    </div>
  );
}

export function StadiumWireframeLazy() {
  const [show3D, setShow3D] = useState(false);

  useEffect(() => {
    setShow3D(canUse3D());
  }, []);

  if (!show3D) return <StadiumFallback />;
  return (
    <div className="absolute inset-0" aria-hidden>
      <StadiumWireframe3D />
    </div>
  );
}
