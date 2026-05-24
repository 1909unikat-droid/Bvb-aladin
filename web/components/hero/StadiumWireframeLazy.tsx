"use client";

import dynamic from "next/dynamic";

const StadiumWireframe3D = dynamic(() => import("./StadiumWireframe3D"), {
  ssr: false,
  loading: () => null,
});

export function StadiumWireframeLazy() {
  return (
    <div className="absolute inset-0" aria-hidden>
      <StadiumWireframe3D />
    </div>
  );
}
