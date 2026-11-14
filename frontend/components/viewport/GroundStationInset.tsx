"use client";
// Ground-station inset: the NASA DSN 34 m antenna model at the serving complex, slewed to the
// spacecraft's azimuth / elevation (computed in the main view), with the link leaving the dish.
import { Line } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import { useLinkVisual } from "@/hooks/useLinkVisual";
import { COLORS, DSN_STATIONS } from "@/lib/constants";
import { anchors } from "@/lib/sceneLayout";
import { servingStation, useStore } from "@/lib/store";
import { DsnAntenna } from "@/components/scene/DsnAntenna";
import { enableShadows, MODEL, useNormalizedModel } from "@/components/scene/models";

/** Geographic azimuth (from north, towards east) -> model azimuth (0 = +Z, towards +X), north = -Z. */
const modelAz = (geoAz: number) => Math.PI - geoAz;
const DISH_HEIGHT = 0.62;

function Beam({ visible, color }: { visible: boolean; color: string }) {
  const line = useRef<Line2>(null);
  const init = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(0, 1, 0)], []);
  useFrame(() => {
    const az = anchors.stationAz;
    const el = Math.max(0.1, anchors.stationEl);
    const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    const a = new THREE.Vector3(0, DISH_HEIGHT, 0).addScaledVector(d, 0.35);
    const b = a.clone().addScaledVector(d, 6);
    line.current?.geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
  });
  return <Line ref={line} points={init} color={color} lineWidth={1.25} transparent opacity={0.75} visible={visible} />;
}

/** The complex's 70 m antenna (NASA DSN 70-meter model), parked, behind the tracking 34 m dish. */
function SeventyMeter() {
  const { object } = useNormalizedModel(MODEL.dsn70, 2.1, "base");
  useEffect(() => enableShadows(object), [object]);
  return <primitive object={object} position={[-2.3, 0, -0.9]} rotation={[0, 0.6, 0]} />;
}

function Site() {
  const link = useLinkVisual();
  return (
    <>
      <color attach="background" args={["#0b0d0e"]} />
      <fog attach="fog" args={["#0b0d0e", 5, 11]} />
      <ambientLight intensity={0.25} color="#b8c4d4" />
      <directionalLight position={[-3, 5, 2.5]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-1.5} shadow-camera-right={1.5} shadow-camera-top={1.5} shadow-camera-bottom={-1.5} shadow-radius={4} shadow-bias={-0.0005} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 48]} />
        <meshStandardMaterial color="#25292b" roughness={1} />
      </mesh>
      <Suspense fallback={null}>
        <DsnAntenna pointing={() => ({ az: modelAz(anchors.stationAz), el: anchors.stationEl })} size={1.25} shadows />
      </Suspense>
      <Suspense fallback={null}>
        <SeventyMeter />
      </Suspense>
      <Beam visible={link !== "down"} color={link === "window" ? COLORS.caution : COLORS.accent} />
    </>
  );
}

function usePointingReadout() {
  const [v, setV] = useState({ az: 0, el: 0 });
  useEffect(() => {
    const id = window.setInterval(() => {
      const az = ((THREE.MathUtils.radToDeg(anchors.stationAz) % 360) + 360) % 360;
      setV({ az, el: THREE.MathUtils.radToDeg(anchors.stationEl) });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  return v;
}

export function GroundStationInset() {
  const mission = useStore((s) => s.mission);
  const link = useLinkVisual();
  const station = DSN_STATIONS.find((s) => s.id === servingStation(mission))!;
  const p = usePointingReadout();
  return (
    <div className="panel pointer-events-auto w-[280px] overflow-hidden !bg-sunken shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
        <span className="text-[12px] font-semibold">DSN {station.name} · {station.antenna} (34 m)</span>
        <span className="text-[11px] text-fg-3">70 m behind</span>
      </div>
      <div className="relative h-[170px]">
        <Canvas
          shadows="soft"
          dpr={[1, 2]}
          camera={{ position: [2.0, 1.25, 3.3], fov: 38 }}
          onCreated={({ camera }) => camera.lookAt(-0.6, 0.55, -0.3)}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
        >
          <Site />
        </Canvas>
      </div>
      <div className="num grid grid-cols-3 border-t border-line px-2.5 py-1.5 text-[11px]">
        <span className="text-fg-3">Az <span className="text-fg">{p.az.toFixed(0)}°</span></span>
        <span className="text-fg-3">El <span className="text-fg">{p.el.toFixed(0)}°</span></span>
        <span className="text-right" style={{ color: link === "down" ? COLORS.fg3 : link === "window" ? COLORS.caution : COLORS.nominal }}>
          {link === "down" ? "No signal" : link === "window" ? "Window" : "Tracking"}
        </span>
      </div>
    </div>
  );
}
