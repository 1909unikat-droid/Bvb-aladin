"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Signal Iduna Park (Westfalenstadion) — Low-Poly Wireframe in BVB-Yellow.
 * Charakteristisch: rechteckiger Grundriss, Südtribüne (Yellow Wall) deutlich höher.
 */
function WestfalenstadionGeometry() {
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];

    // Hilfsfunktion: Linie hinzufügen
    const line = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number
    ) => {
      pts.push(new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz));
    };

    // ── Grundriss-Kontur (rectanguläreres Stadion-Shape) ──────────────────
    // Maße: Breite (E-W) = 2.6, Länge (N-S) = 2.0, Eckenradius = 0.42
    const W = 2.6, L = 2.0, R = 0.42;
    const SEGS = 10; // Punkte pro Ecke

    // Alle Grundriss-Punkte aufbauen (4 abgerundete Ecken)
    const corners: [number, number, number][] = [
      [W - R,  L - R, -Math.PI / 2], // NE
      [-(W-R), L - R,  0           ], // NW
      [-(W-R),-(L-R),  Math.PI / 2 ], // SW
      [ W - R,-(L-R),  Math.PI     ], // SE
    ];

    const basePts: [number, number][] = [];
    for (const [cx, cy, startA] of corners) {
      for (let i = 0; i <= SEGS; i++) {
        const a = startA + (i / SEGS) * (Math.PI / 2);
        basePts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
      }
    }
    const N = basePts.length;

    // Wandhöhe je Punkt:
    // Südtribüne = y < -(L*0.55) → deutlich höher (Yellow Wall)
    // Nordtribüne = y > +(L*0.55) → etwas niedriger
    const wallH = (y: number): number => {
      if (y < -(L * 0.55)) {
        const t = Math.min(1, (-(y + L * 0.55)) / (L * 0.35));
        return 0.62 + t * 0.38; // max ~1.00 für Südtribüne
      }
      if (y > (L * 0.55)) return 0.56; // Nordtribüne leicht niedriger
      return 0.62; // Ost/West-Tribünen
    };

    // ── Bodenlinie ────────────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const [x0, y0] = basePts[i]!;
      const [x1, y1] = basePts[(i + 1) % N]!;
      line(x0, y0, 0, x1, y1, 0);
    }

    // Roof-Punkte: leicht nach innen versetzt
    const INSET = 0.16;
    const roofPts: [number, number, number][] = basePts.map(([x, y]) => {
      const dist = Math.sqrt(x * x + y * y);
      const ix = dist > 0.01 ? x - (x / dist) * INSET : x;
      const iy = dist > 0.01 ? y - (y / dist) * INSET : y;
      return [ix, iy, wallH(y)];
    });

    // ── Dachkante (obere Außenkante) ──────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const [x0, y0, z0] = roofPts[i]!;
      const [x1, y1, z1] = roofPts[(i + 1) % N]!;
      line(x0, y0, z0, x1, y1, z1);
    }

    // ── Wand-Stützen (Boden → Dach, jeden 3. Punkt) ──────────────────────
    for (let i = 0; i < N; i += 3) {
      const [fx, fy] = basePts[i]!;
      const [rx, ry, rz] = roofPts[i]!;
      line(fx, fy, 0, rx, ry, rz);
    }

    // ── Tribünen-Profil: diagonale Streben (zeigen Steilheit der Sitzreihen)
    for (let i = 1; i < N; i += 6) {
      const [fx, fy] = basePts[i]!;
      const [rx, ry, rz] = roofPts[i]!;
      // Innenkante am Boden (Spielfeld-Seite)
      const inF = 0.55;
      const dist = Math.sqrt(fx * fx + fy * fy);
      if (dist < 0.01) continue;
      const mx = fx - (fx / dist) * (dist * inF);
      const my = fy - (fy / dist) * (dist * inF);
      // Tribünen-Profil-Linie (Boden-innen → Dach-außen)
      line(mx, my, 0.04, rx, ry, rz);
    }

    // ── Spielfeld-Markierungen ────────────────────────────────────────────
    const z = 0.02;
    const pw = 1.45, pl = 1.85; // Spielfeld-Hälfte Breite/Länge

    // Spielfeld-Rand
    line(-pw, -pl, z,  pw, -pl, z);
    line( pw, -pl, z,  pw,  pl, z);
    line( pw,  pl, z, -pw,  pl, z);
    line(-pw,  pl, z, -pw, -pl, z);

    // Mittellinie
    line(-pw, 0, z, pw, 0, z);

    // Mittelkreis
    const CR = 0.43, MC = 40;
    for (let i = 0; i < MC; i++) {
      const a0 = (i / MC) * Math.PI * 2;
      const a1 = ((i + 1) / MC) * Math.PI * 2;
      line(Math.cos(a0) * CR, Math.sin(a0) * CR, z,
           Math.cos(a1) * CR, Math.sin(a1) * CR, z);
    }

    // Strafräume (Süd / Nord)
    for (const [sy, sg] of [[-pl, 1], [pl, -1]] as [number, number][]) {
      const bw = 0.55, bd = 0.34;
      line(-bw, sy, z,  bw, sy, z);
      line(-bw, sy, z, -bw, sy + sg * bd, z);
      line( bw, sy, z,  bw, sy + sg * bd, z);
      line(-bw, sy + sg * bd, z, bw, sy + sg * bd, z);
      // 5m-Raum
      line(-0.27, sy, z,  0.27, sy, z);
      line(-0.27, sy, z, -0.27, sy + sg * 0.14, z);
      line( 0.27, sy, z,  0.27, sy + sg * 0.14, z);
      line(-0.27, sy + sg * 0.14, z, 0.27, sy + sg * 0.14, z);
    }

    // Eckfahnen
    for (const [cx, cy] of [[-pw, -pl], [pw, -pl], [pw, pl], [-pw, pl]] as [number, number][]) {
      line(cx, cy, z, cx, cy, z + 0.14);
    }

    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.10;
    }
  });

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2.8, 0, 0]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#fde100" linewidth={1.2} transparent opacity={0.72} />
      </lineSegments>
    </group>
  );
}

export default function StadiumWireframe3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[4, 4, 6]} intensity={1.4} color="#fde100" />
      <pointLight position={[-3, -3, 5]} intensity={0.35} color="#ffffff" />
      <WestfalenstadionGeometry />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 4}
      />
    </Canvas>
  );
}
