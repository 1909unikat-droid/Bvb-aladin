"use client";
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Stadion-Grundriss-Punkte (XZ-Ebene, Y = oben) */
function mkContour(w: number, h: number, r: number, seg = 8): [number, number][] {
  const pts: [number, number][] = [];
  for (const [cx, cz, a0] of [
    [w - r,  h - r, -Math.PI / 2],
    [-(w-r), h - r,  0           ],
    [-(w-r),-(h-r),  Math.PI / 2 ],
    [w - r, -(h-r),  Math.PI     ],
  ] as [number, number, number][]) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

const YELLOW = new THREE.Color("#fde100");
const DARK   = new THREE.Color("#1c1c1c");

/** Ring-Mesh: innere Kontur auf Y=0, äußere Kontur erhöht — mit Vertex-Farben */
function buildBowl(
  inner: [number, number][],
  outer: [number, number][],
  hFn:   (z: number) => number,
  cFn:   (z: number, isOuter: boolean) => THREE.Color,
) {
  const N = inner.length;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const [ix0, iz0] = inner[i]!, [ix1, iz1] = inner[j]!;
    const [ox0, oz0] = outer[i]!, [ox1, oz1] = outer[j]!;
    const oy0 = hFn(oz0), oy1 = hFn(oz1);
    const b = pos.length / 3;
    pos.push(ix0, 0, iz0, ix1, 0, iz1, ox0, oy0, oz0, ox1, oy1, oz1);
    for (const c of [
      cFn(iz0, false), cFn(iz1, false),
      cFn(oz0, true),  cFn(oz1, true),
    ]) col.push(c.r, c.g, c.b);
    idx.push(b, b+2, b+1, b+1, b+2, b+3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color",    new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Dach-Ring: gleichmäßig über den Tribünen */
function buildRoof(
  inner: [number, number][],
  outer: [number, number][],
  hFn:  (z: number) => number,
) {
  const N = inner.length;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const [ix0, iz0] = inner[i]!, [ix1, iz1] = inner[j]!;
    const [ox0, oz0] = outer[i]!, [ox1, oz1] = outer[j]!;
    const iy0 = hFn(iz0), iy1 = hFn(iz1);
    const oy0 = hFn(oz0), oy1 = hFn(oz1);
    const b = pos.length / 3;
    pos.push(ix0, iy0, iz0, ix1, iy1, iz1, ox0, oy0, oz0, ox1, oy1, oz1);
    idx.push(b, b+2, b+1, b+1, b+2, b+3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ── Hauptkomponente ──────────────────────────────────────────────────── */
function Westfalenstadion() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y -= dt * 0.22; });

  const { bowl, roof, pitchGeo, lineGeo } = useMemo(() => {
    const SUDZ = 1.15; // z > SUDZ = Südtribüne (Yellow Wall)

    // Tribünen-Konturen
    const inner = mkContour(1.30, 0.95, 0.22);
    const outer = mkContour(2.25, 1.70, 0.32);

    // Höhe: Südtribüne höher, Nordtribüne etwas niedriger
    const hFn = (z: number) =>
      z >  SUDZ ? 0.95 :
      z < -SUDZ ? 0.55 : 0.62;

    // Farbe: Südtribüne außen gelb (Yellow Wall!)
    const cFn = (z: number, isOuter: boolean): THREE.Color =>
      (isOuter && z > SUDZ * 0.75) ? YELLOW : DARK;

    const bowl = buildBowl(inner, outer, hFn, cFn);

    // Dach-Konturen
    const roofI = mkContour(2.10, 1.58, 0.28);
    const roofO = mkContour(2.58, 1.92, 0.35);
    const roofHFn = (z: number) =>
      z >  SUDZ ? 1.02 :
      z < -SUDZ ? 0.60 : 0.68;
    const roof = buildRoof(roofI, roofO, roofHFn);

    // Spielfeld-Geometrie (XZ-Plane)
    const pitchShape = new THREE.Shape([
      new THREE.Vector2(-1.05, -0.68),
      new THREE.Vector2( 1.05, -0.68),
      new THREE.Vector2( 1.05,  0.68),
      new THREE.Vector2(-1.05,  0.68),
    ]);
    const pitchGeo = new THREE.ShapeGeometry(pitchShape);
    pitchGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

    // Spielfeld-Linien: Mittellinie + Mittelkreis-Punkte
    const linePts: THREE.Vector3[] = [];
    // Mittellinie
    linePts.push(new THREE.Vector3(-1.05, 0.003, 0), new THREE.Vector3(1.05, 0.003, 0));
    // Mittelkreis
    const CR = 0.42, SEG = 48;
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2;
      const a1 = ((i + 1) / SEG) * Math.PI * 2;
      linePts.push(
        new THREE.Vector3(Math.cos(a0) * CR, 0.003, Math.sin(a0) * CR),
        new THREE.Vector3(Math.cos(a1) * CR, 0.003, Math.sin(a1) * CR),
      );
    }
    // Strafraum Nord + Süd
    for (const sz of [-0.68, 0.68] as number[]) {
      const sg = sz < 0 ? 1 : -1;
      const bw = 0.55, bd = 0.34;
      linePts.push(
        new THREE.Vector3(-bw, 0.003, sz), new THREE.Vector3(bw, 0.003, sz),
        new THREE.Vector3(-bw, 0.003, sz), new THREE.Vector3(-bw, 0.003, sz + sg * bd),
        new THREE.Vector3( bw, 0.003, sz), new THREE.Vector3( bw, 0.003, sz + sg * bd),
        new THREE.Vector3(-bw, 0.003, sz + sg * bd), new THREE.Vector3(bw, 0.003, sz + sg * bd),
      );
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);

    return { bowl, roof, pitchGeo, lineGeo };
  }, []);

  return (
    <group ref={ref}>
      {/* Bodenplatte */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[7, 6]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} />
      </mesh>

      {/* Spielfeld grün */}
      <mesh geometry={pitchGeo}>
        <meshStandardMaterial color="#2d6b1c" roughness={0.9} />
      </mesh>

      {/* Spielfeld-Streifen */}
      {([-0.525, 0, 0.525] as number[]).map((x) => (
        <mesh key={x} position={[x, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 1.36]} />
          <meshStandardMaterial color="#285f18" roughness={0.9} transparent opacity={0.45} />
        </mesh>
      ))}

      {/* Spielfeld-Linien */}
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color="white" transparent opacity={0.55} />
      </lineSegments>

      {/* Tribünen-Bowl (Südtribüne gelb, Rest dunkel) */}
      <mesh geometry={bowl}>
        <meshStandardMaterial vertexColors roughness={0.75} side={THREE.DoubleSide} />
      </mesh>

      {/* Dach (metallisch) */}
      <mesh geometry={roof}>
        <meshStandardMaterial color="#2a2a2a" metalness={0.55} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function StadiumWireframe3D() {
  return (
    <Canvas
      camera={{ position: [0, 6.5, 2.2], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 10, 1]} intensity={1.0} castShadow={false} />
      <pointLight position={[0, 3, 1.5]} intensity={0.6} color="#fde100" />
      <Westfalenstadion />
    </Canvas>
  );
}
