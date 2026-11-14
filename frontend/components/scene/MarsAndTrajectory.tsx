"use client";
// Mars (NASA map) with MRO, and the Earth -> Mars transfer arc as a thin reference line.
import { Html, Line, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { anchors, MARS_POS, MARS_R, TRAJECTORY } from "@/lib/sceneLayout";
import { NASA_TEXTURE } from "./models";
import { MroOrbit } from "./Orbiters";

/** Mars with the NASA 3D Resources global map, and MRO (the real Mars relay orbiter) around it. */
export function Mars() {
  const map = useTexture(NASA_TEXTURE.marsMap);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }, [map]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01;
  });
  return (
    <group position={MARS_POS}>
      <group rotation={[0, 0, 0.44]}>
        <mesh ref={ref}>
          <sphereGeometry args={[MARS_R, 64, 32]} />
          <meshStandardMaterial map={map} roughness={0.95} metalness={0} />
        </mesh>
      </group>
      <MroOrbit marsR={MARS_R} />
      <Html position={[MARS_R * 1.4, 0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="scene-label scene-label--plain" style={{ transform: "translate(6px, -50%)" }}>Mars</div>
      </Html>
    </group>
  );
}

/** The arc, split at the habitat: flown part solid (a faint trail), the rest dashed. Re-split every 2 s. */
export function Trajectory() {
  const [t, setT] = useState(anchors.craftT);
  useEffect(() => {
    const id = window.setInterval(() => setT(anchors.craftT), 2000);
    return () => window.clearInterval(id);
  }, []);
  const { flown, ahead } = useMemo(() => {
    const pts = TRAJECTORY.getPoints(400);
    const split = Math.max(1, Math.round(t * 400));
    return { flown: pts.slice(0, split + 1), ahead: pts.slice(split) };
  }, [t]);
  return (
    <group>
      <Line points={flown} color="#858c90" lineWidth={1} transparent opacity={0.35} />
      <Line points={ahead} color="#858c90" lineWidth={1} dashed dashSize={0.35} gapSize={0.35} transparent opacity={0.16} />
    </group>
  );
}
