"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/** Low-poly Stadiongrundriss — reines Drahtmodell in BVB-Yellow. */
function StadiumGeometry() {
  const meshRef = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Oval stadium footprint
    const rx = 2.6, ry = 1.6;
    const pts = 64;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    const extrudeSettings = { depth: 0.55, bevelEnabled: false, steps: 1 };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  // Inner pitch lines — as lineSegments pairs (start/end per segment)
  const pitchLines = useMemo(() => {
    const pairs: THREE.Vector3[] = [];
    const z = 0.57;
    // Centre circle (pairs of adjacent arc points)
    const cr = 0.55;
    const arcPts = 32;
    for (let i = 0; i < arcPts; i++) {
      const a0 = (i / arcPts) * Math.PI * 2;
      const a1 = ((i + 1) / arcPts) * Math.PI * 2;
      pairs.push(
        new THREE.Vector3(Math.cos(a0) * cr, Math.sin(a0) * cr, z),
        new THREE.Vector3(Math.cos(a1) * cr, Math.sin(a1) * cr, z),
      );
    }
    // Centre line
    pairs.push(new THREE.Vector3(-1.8, 0, z), new THREE.Vector3(1.8, 0, z));
    // Penalty boxes (4 edges each)
    [-1.6, 1.6].forEach((sx) => {
      const sign = sx < 0 ? -1 : 1;
      const x1 = sx + sign * 0.45;
      pairs.push(
        new THREE.Vector3(sx, -0.45, z), new THREE.Vector3(x1, -0.45, z),
        new THREE.Vector3(x1, -0.45, z), new THREE.Vector3(x1, 0.45, z),
        new THREE.Vector3(x1, 0.45, z), new THREE.Vector3(sx, 0.45, z),
        new THREE.Vector3(sx, 0.45, z), new THREE.Vector3(sx, -0.45, z),
      );
    });
    return new THREE.BufferGeometry().setFromPoints(pairs);
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.12;
    }
  });

  return (
    <group ref={meshRef} rotation={[-Math.PI / 3.5, 0, 0]}>
      {/* Shell */}
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#fde100" linewidth={1.2} transparent opacity={0.65} />
      </lineSegments>
      {/* Pitch lines */}
      <lineSegments geometry={pitchLines}>
        <lineBasicMaterial color="#fde100" transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

export default function StadiumWireframe3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[4, 4, 6]} intensity={1.2} color="#fde100" />
      <StadiumGeometry />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.6}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 4}
      />
    </Canvas>
  );
}
