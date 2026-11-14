"use client";
// NASA spacecraft models in slow, plausible orbits (periods compressed, distances not to scale):
//   TDRS  - near-Earth relay satellite, high Earth orbit
//   LRO   - Lunar Reconnaissance Orbiter around the Moon
//   MRO   - Mars Reconnaissance Orbiter, the real Mars relay, around Mars
import { useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { HoverLabel } from "./HoverLabel";
import { MODEL, useNormalizedModel } from "./models";

function Model({ url, size }: { url: string; size: number }) {
  const { object } = useNormalizedModel(url, size);
  return <primitive object={object} />;
}

interface OrbitProps {
  url: string;
  label: string;
  /** model size, scene units */
  size: number;
  radius: number;
  /** seconds per revolution (compressed) */
  period: number;
  /** orbit plane tilt (radians, about X) */
  inclination?: number;
  phase?: number;
}

/** A model on a circular orbit around the parent group's origin, nose along the velocity. */
export function Orbiter({ url, label, size, radius, period, inclination = 0.3, phase = 0 }: OrbitProps) {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const a = phase + (clock.elapsedTime / period) * Math.PI * 2;
    const g = body.current;
    if (!g) return;
    g.position.set(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
    g.rotation.set(0, a, 0);
  });
  return (
    <group rotation={[inclination, 0, 0]}>
      <group ref={body}>
        <HoverLabel label={label} hitRadius={Math.max(size, 0.3)} offset={[size * 0.6, 0, 0]}>
          <Suspense fallback={null}>
            <Model url={url} size={size} />
          </Suspense>
        </HoverLabel>
      </group>
    </group>
  );
}

export const TdrsOrbit = () => (
  <Orbiter url={MODEL.tdrs} label="TDRS · NASA relay satellite" size={0.38} radius={4.4} period={420} inclination={0.12} phase={2.2} />
);
export const LroOrbit = () => (
  <Orbiter url={MODEL.lro} label="LRO · Lunar Reconnaissance Orbiter" size={0.22} radius={0.95} period={150} inclination={1.2} />
);
export const MroOrbit = ({ marsR }: { marsR: number }) => (
  <Orbiter url={MODEL.mro} label="MRO · Mars relay orbiter" size={0.45} radius={marsR * 1.7} period={180} inclination={0.5} />
);
