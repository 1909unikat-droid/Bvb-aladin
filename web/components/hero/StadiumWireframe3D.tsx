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

/* ── Flutlichtmast ──────────────────────────────────────────────────────── */
function Pylon({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* Mast */}
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 2.6, 6]} />
        <meshStandardMaterial color="#3d3d3d" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Lichtbalken */}
      <mesh position={[0, 2.62, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.45, 0.12, 0.18]} />
        <meshStandardMaterial color="#b0b0b0" metalness={0.9} roughness={0.15} emissive="#fffff0" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/* ── Hauptkomponente ──────────────────────────────────────────────────── */
function Westfalenstadion() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y -= dt * 0.18; });

  const { bowl, roof, pitchGeo, lineGeo } = useMemo(() => {
    const SUDZ = 1.15;

    const inner = mkContour(1.30, 0.95, 0.22);
    const outer = mkContour(2.25, 1.70, 0.32);

    const hFn = (z: number) =>
      z >  SUDZ ? 1.05 :
      z < -SUDZ ? 0.65 : 0.72;

    const cFn = (z: number, isOuter: boolean): THREE.Color =>
      (isOuter && z > SUDZ * 0.7) ? YELLOW : DARK;

    const bowl = buildBowl(inner, outer, hFn, cFn);

    const roofI = mkContour(2.10, 1.58, 0.28);
    const roofO = mkContour(2.60, 1.94, 0.36);
    const roofHFn = (z: number) =>
      z >  SUDZ ? 1.14 :
      z < -SUDZ ? 0.72 : 0.80;
    const roof = buildRoof(roofI, roofO, roofHFn);

    const pitchShape = new THREE.Shape([
      new THREE.Vector2(-1.05, -0.68),
      new THREE.Vector2( 1.05, -0.68),
      new THREE.Vector2( 1.05,  0.68),
      new THREE.Vector2(-1.05,  0.68),
    ]);
    const pitchGeo = new THREE.ShapeGeometry(pitchShape);
    pitchGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

    const linePts: THREE.Vector3[] = [];
    linePts.push(new THREE.Vector3(-1.05, 0.003, 0), new THREE.Vector3(1.05, 0.003, 0));
    const CR = 0.42, SEG = 48;
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2;
      const a1 = ((i + 1) / SEG) * Math.PI * 2;
      linePts.push(
        new THREE.Vector3(Math.cos(a0) * CR, 0.003, Math.sin(a0) * CR),
        new THREE.Vector3(Math.cos(a1) * CR, 0.003, Math.sin(a1) * CR),
      );
    }
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

  const pylons: [number, number][] = [
    [-2.45, -1.88],
    [ 2.45, -1.88],
    [-2.45,  1.88],
    [ 2.45,  1.88],
  ];

  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[8, 7]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} />
      </mesh>

      <mesh geometry={pitchGeo}>
        <meshStandardMaterial color="#2d6b1c" roughness={0.9} />
      </mesh>

      {([-0.525, 0, 0.525] as number[]).map((x) => (
        <mesh key={x} position={[x, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 1.36]} />
          <meshStandardMaterial color="#285f18" roughness={0.9} transparent opacity={0.45} />
        </mesh>
      ))}

      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color="white" transparent opacity={0.6} />
      </lineSegments>

      <mesh geometry={bowl}>
        <meshStandardMaterial vertexColors roughness={0.75} side={THREE.DoubleSide} />
      </mesh>

      <mesh geometry={roof}>
        <meshStandardMaterial color="#252525" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>

      {pylons.map(([px, pz], i) => (
        <Pylon key={i} x={px} z={pz} />
      ))}
    </group>
  );
}

export default function StadiumWireframe3D() {
  return (
    <Canvas
      camera={{ position: [0, 3.2, 6.2], fov: 44 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 6, 5]} intensity={1.2} castShadow={false} />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} color="#c0c8ff" />
      <pointLight position={[0, 2.5, 2]} intensity={0.8} color="#fde100" />
      <Westfalenstadion />
    </Canvas>
  );
}
