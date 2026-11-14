"use client";
// Situational-awareness view: Earth with the DSN complexes, the AEGIS-1 habitat, Mars, the link
// and the bundles on it. Physically plausible lighting: one directional Sun with soft shadows,
// almost no ambient, ACES tone mapping at modest exposure. Bloom only catches HDR emissives
// (nav lights, the link beam, packets), matching the Blender film; lit surfaces stay below threshold.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { FALLBACK_SPACECRAFT_NAME } from "@/lib/constants";
import { anchors, CRAFT_POS, SUN_DIR } from "@/lib/sceneLayout";
import { servingStation, useStore } from "@/lib/store";
import { CameraRig } from "./CameraRig";
import { Earth, EarthPlaceholder } from "./Earth";
import { LinkLine } from "./LinkLine";
import { Mars, Trajectory } from "./MarsAndTrajectory";
import { Moon } from "./Moon";
import { TdrsOrbit } from "./Orbiters";
import { preloadModels } from "./models";
import { Packets } from "./Packets";
import { Spacecraft } from "./Spacecraft";
import { Starfield } from "./Starfield";

preloadModels();

/** Sunlight with a shadow camera fitted tightly around the habitat (soft self-shadowing). */
function Sun() {
  const scene = useThree((s) => s.scene);
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight("#fff6ea", 2.6);
    l.position.copy(CRAFT_POS).addScaledVector(SUN_DIR, 12);
    l.target.position.copy(CRAFT_POS);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = cam.bottom = -1.6;
    cam.right = cam.top = 1.6;
    cam.near = 4;
    cam.far = 20;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.01;
    l.shadow.radius = 3;
    return l;
  }, []);
  useEffect(() => {
    scene.add(light, light.target);
    return () => void scene.remove(light, light.target);
  }, [scene, light]);
  // keep the tight shadow frustum on the travelling habitat
  useFrame(() => {
    light.target.position.copy(anchors.craft);
    light.position.copy(anchors.craft).addScaledVector(SUN_DIR, 12);
  });
  return null;
}

function windowSecondsLeft(until?: string | null) {
  if (!until) return null;
  const t = Date.parse(until);
  return Number.isFinite(t) ? (t - Date.now()) / 1000 : null;
}

function World() {
  const link = useLinkVisual();
  const mission = useStore((s) => s.mission);
  const sc = useStore((s) => s.spacecraft);
  const serving = servingStation(mission);
  const name = mission?.spacecraft?.name ?? FALLBACK_SPACECRAFT_NAME;

  return (
    <>
      <color attach="background" args={["#030405"]} />
      <ambientLight intensity={0.035} color="#9fb4d0" />
      {/* faint earthshine-like fill from the Earth side so the shadowed side is not pure black */}
      <hemisphereLight args={["#2b3a52", "#000000", 0.18]} />
      <Sun />

      <Suspense fallback={null}>
        <Starfield />
      </Suspense>
      <Suspense fallback={<EarthPlaceholder />}>
        <Earth serving={serving} />
      </Suspense>
      <Suspense fallback={null}>
        <Mars />
        <Moon />
        <TdrsOrbit />
      </Suspense>
      <Trajectory />
      <Suspense fallback={null}>
        <Spacecraft name={name} />
      </Suspense>
      <LinkLine link={link} windowLeftS={link === "window" ? windowSecondsLeft(sc?.link.window_until) : null} />
      <Packets />
      <CameraRig />
      {/* the composer disables renderer tone mapping while mounted, so ACES runs as the last pass */}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0.9} radius={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

export default function Scene() {
  return (
    <Canvas
      className="!absolute inset-0"
      style={{ touchAction: "none" }}       // pinch zooms the scene, not the page
      dpr={[1, 2]}
      shadows="soft"
      camera={{ fov: 36, near: 0.02, far: 2500, position: [10, 7, 27] }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      <World />
    </Canvas>
  );
}
