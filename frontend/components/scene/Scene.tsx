"use client";
// The full-screen 3D hero: Earth + DSN, the spacecraft, Mars, the link and the packets.
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { FALLBACK_SPACECRAFT_NAME } from "@/lib/constants";
import { SUN_DIR } from "@/lib/sceneLayout";
import { servingStation, useStore } from "@/lib/store";
import { CameraRig } from "./CameraRig";
import { Earth } from "./Earth";
import { LinkBeam } from "./LinkBeam";
import { Mars, Trajectory } from "./MarsAndTrajectory";
import { Packets } from "./Packets";
import { Spacecraft } from "./Spacecraft";
import { Starfield } from "./Starfield";

function World() {
  const link = useLinkVisual();
  const mission = useStore((s) => s.mission);
  const serving = servingStation(mission);
  const name = mission?.spacecraft?.name ?? FALLBACK_SPACECRAFT_NAME;
  const sunPos = useMemo(() => SUN_DIR.clone().multiplyScalar(80), []);

  return (
    <>
      <color attach="background" args={["#010309"]} />
      <ambientLight intensity={0.06} color="#8fb4ff" />
      <directionalLight position={sunPos} intensity={3.2} color="#fff3e2" />
      <directionalLight position={[20, -10, -30]} intensity={0.25} color="#4a7dff" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#fff1dc" position={SUN_DIR.clone().multiplyScalar(10).toArray()} scale={[8, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#3a6cff" position={[0, -10, 0]} scale={[20, 20, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.4} color="#9ad8ff" position={[10, 5, -10]} scale={6} target={[0, 0, 0]} />
      </Environment>

      <Starfield />
      <Suspense fallback={null}>
        <Earth serving={serving} link={link} />
      </Suspense>
      <Mars />
      <Trajectory />
      <Spacecraft link={link} name={name} />
      <LinkBeam link={link} />
      <Packets />
      <CameraRig />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.85} luminanceSmoothing={0.2} radius={0.75} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

export default function Scene() {
  return (
    <Canvas
      className="!fixed inset-0"
      dpr={[1, 1.75]}
      camera={{ fov: 40, near: 0.05, far: 2500, position: [-6, 12, 38] }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
    >
      <World />
    </Canvas>
  );
}
