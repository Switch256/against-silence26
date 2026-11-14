"use client";
// The Moon with NASA's LRO colour map (SVS CGI Moon Kit), on a slow orbit around the Earth,
// with the Lunar Reconnaissance Orbiter around it. Distance and period not to scale.
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HoverLabel } from "./HoverLabel";
import { NASA_TEXTURE } from "./models";
import { LroOrbit } from "./Orbiters";

const MOON_R = 0.62;
const ORBIT_R = 7.2;
const PERIOD_S = 900;

export function Moon() {
  const map = useTexture(NASA_TEXTURE.moonMap);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }, [map]);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const a = 2.4 + (clock.elapsedTime / PERIOD_S) * Math.PI * 2;
    if (!body.current) return;
    body.current.position.set(Math.cos(a) * ORBIT_R, 0, -Math.sin(a) * ORBIT_R);
    body.current.rotation.y = a + Math.PI; // tidally locked: same face towards Earth
  });
  return (
    <group rotation={[0.09, 0, 0]}>
      <group ref={body}>
        <HoverLabel label="Moon · NASA LRO colour map" hitRadius={MOON_R * 1.05} offset={[MOON_R * 1.1, 0, 0]}>
          <mesh>
            <sphereGeometry args={[MOON_R, 64, 32]} />
            <meshStandardMaterial map={map} roughness={0.95} metalness={0} />
          </mesh>
        </HoverLabel>
        <LroOrbit />
      </group>
    </group>
  );
}
