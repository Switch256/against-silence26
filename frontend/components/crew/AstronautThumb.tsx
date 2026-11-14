"use client";
// Crew identity thumbnail: the NASA astronaut model (NASA 3D Resources), static three-quarter view.
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { MODEL, useNormalizedModel } from "@/components/scene/models";

function Astronaut() {
  const { object } = useNormalizedModel(MODEL.astronaut, 1.9);
  return <primitive object={object} rotation={[0, -0.5, 0]} position={[0, -0.12, 0]} />;
}

export function AstronautThumb() {
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded border border-line bg-sunken">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.45, 2.3], fov: 30 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
        frameloop="demand"
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[-2, 3, 3]} intensity={2.4} />
        <directionalLight position={[3, 1, -2]} intensity={0.5} color="#9fb4d0" />
        <Suspense fallback={null}>
          <Astronaut />
        </Suspense>
      </Canvas>
    </div>
  );
}
