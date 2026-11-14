"use client";
// A crewed deep-space transit vehicle, built procedurally:
// crew capsule -> inflatable habitat (with high-gain antenna) -> node -> truss with solar wings
// and radiators -> service module -> main engine. +Z is the direction of travel.
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "@/lib/constants";
import { anchors, CRAFT_POS, CRAFT_SCALE, CRAFT_T, TRAJECTORY } from "@/lib/sceneLayout";
import type { LinkVisual } from "@/lib/store";
import { foilTexture, glowTexture, solarTexture } from "./textures";

const Z = new THREE.Euler(Math.PI / 2, 0, 0); // cylinder axis Y -> Z

function useMaterials() {
  return useMemo(() => {
    const foil = foilTexture();
    return {
      hull: new THREE.MeshStandardMaterial({ color: "#e9edf2", roughness: 0.55, metalness: 0.15 }),
      hullDark: new THREE.MeshStandardMaterial({ color: "#9aa3ae", roughness: 0.45, metalness: 0.5 }),
      fabric: new THREE.MeshStandardMaterial({ color: "#efe8da", roughness: 0.9, metalness: 0.0 }),
      metal: new THREE.MeshStandardMaterial({ color: "#c3c9d1", roughness: 0.3, metalness: 0.85 }),
      truss: new THREE.MeshStandardMaterial({ color: "#8d96a3", roughness: 0.4, metalness: 0.8 }),
      gold: new THREE.MeshStandardMaterial({ map: foil, color: "#ffd27a", roughness: 0.32, metalness: 1.0 }),
      engine: new THREE.MeshStandardMaterial({ color: "#3a3f47", roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide }),
      engineGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.85, 1.6), toneMapped: false, side: THREE.BackSide, transparent: true, opacity: 0.55 }),
      solar: new THREE.MeshStandardMaterial({ map: solarTexture(), roughness: 0.28, metalness: 0.6, color: "#c8d6ff" }),
      solarBack: new THREE.MeshStandardMaterial({ color: "#d9dde3", roughness: 0.7, metalness: 0.2 }),
      radiator: new THREE.MeshStandardMaterial({ color: "#f4f6f8", roughness: 0.75, metalness: 0.05 }),
      dish: new THREE.MeshStandardMaterial({ color: "#f2f4f7", emissive: "#2a313c", roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide }),
      window: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 1.0), toneMapped: false }),
    };
  }, []);
}

function Truss({ m }: { m: ReturnType<typeof useMaterials> }) {
  const len = 2.0;
  const w = 0.36;
  const members = [];
  for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    members.push(
      <mesh key={`l${x}${y}`} position={[(x * w) / 2, (y * w) / 2, 0]} material={m.truss}>
        <boxGeometry args={[0.035, 0.035, len]} />
      </mesh>,
    );
  }
  const bays = 6;
  for (let i = 0; i <= bays; i++) {
    const z = -len / 2 + (i * len) / bays;
    members.push(
      <group key={`b${i}`} position={[0, 0, z]}>
        <mesh position={[0, w / 2, 0]} material={m.truss}><boxGeometry args={[w, 0.025, 0.025]} /></mesh>
        <mesh position={[0, -w / 2, 0]} material={m.truss}><boxGeometry args={[w, 0.025, 0.025]} /></mesh>
        <mesh position={[w / 2, 0, 0]} material={m.truss}><boxGeometry args={[0.025, w, 0.025]} /></mesh>
        <mesh position={[-w / 2, 0, 0]} material={m.truss}><boxGeometry args={[0.025, w, 0.025]} /></mesh>
      </group>,
    );
    if (i < bays) {
      const diag = Math.hypot(w, len / bays);
      const ang = Math.atan2(len / bays, w);
      members.push(
        <group key={`d${i}`} position={[0, 0, z + len / bays / 2]}>
          <mesh position={[0, w / 2, 0]} rotation={[0, ang * (i % 2 ? 1 : -1), 0]} material={m.truss}><boxGeometry args={[diag, 0.018, 0.018]} /></mesh>
          <mesh position={[0, -w / 2, 0]} rotation={[0, ang * (i % 2 ? -1 : 1), 0]} material={m.truss}><boxGeometry args={[diag, 0.018, 0.018]} /></mesh>
        </group>,
      );
    }
  }
  return <group>{members}</group>;
}

function SolarWing({ side, m, wingRef }: { side: 1 | -1; m: ReturnType<typeof useMaterials>; wingRef: React.RefObject<THREE.Group | null> }) {
  const panelLen = 1.45;
  const panelW = 0.92;
  return (
    <group position={[side * 0.2, 0, 0]}>
      {/* mast */}
      <mesh position={[side * 1.65, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
        <cylinderGeometry args={[0.025, 0.025, 3.3, 8]} />
      </mesh>
      <mesh position={[side * 0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.hullDark}>
        <cylinderGeometry args={[0.07, 0.07, 0.18, 16]} />
      </mesh>
      <group ref={wingRef}>
        {[0, 1].map((i) => (
          <group key={i} position={[side * (0.35 + panelLen / 2 + i * (panelLen + 0.08)), 0, 0]}>
            <mesh material={[m.solarBack, m.solarBack, m.solar, m.solarBack, m.solarBack, m.solarBack]}>
              <boxGeometry args={[panelLen, 0.018, panelW]} />
            </mesh>
            {/* frame rails */}
            <mesh position={[0, 0, panelW / 2]} material={m.metal}><boxGeometry args={[panelLen, 0.03, 0.025]} /></mesh>
            <mesh position={[0, 0, -panelW / 2]} material={m.metal}><boxGeometry args={[panelLen, 0.03, 0.025]} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Dish({ m, link }: { m: ReturnType<typeof useMaterials>; link: LinkVisual }) {
  const dishGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const R = 0.62;
    const depth = 0.2;
    for (let i = 0; i <= 24; i++) {
      const r = (i / 24) * R;
      pts.push(new THREE.Vector2(r, (r * r * depth) / (R * R)));
    }
    const g = new THREE.LatheGeometry(pts, 48);
    g.rotateX(Math.PI / 2); // lathe axis Y -> Z (boresight +Z)
    return g;
  }, []);
  const aim = useRef<THREE.Group>(null);
  const feed = useRef<THREE.Mesh>(null);
  const feedGlow = useRef<THREE.Sprite>(null);
  const color = link === "up" ? COLORS.link : link === "window" ? COLORS.window : COLORS.linkDown;

  useFrame(({ clock }) => {
    if (!aim.current) return;
    aim.current.lookAt(anchors.station);
    if (feed.current) feed.current.getWorldPosition(anchors.dish);
    if (feedGlow.current) {
      const t = clock.elapsedTime;
      const flicker = link === "down" ? (Math.sin(t * 9) > 0.6 ? 0.25 : 0.08) : 0.55 + Math.sin(t * 4) * 0.08;
      feedGlow.current.scale.setScalar(flicker * 1.4);
    }
  });

  return (
    <group position={[0, 0.55, 0.35]}>
      {/* boom + gimbal */}
      <mesh position={[0, 0.35, 0]} material={m.metal}><cylinderGeometry args={[0.03, 0.04, 0.7, 10]} /></mesh>
      <mesh position={[0, 0.72, 0]} material={m.hullDark}><sphereGeometry args={[0.07, 16, 12]} /></mesh>
      <group ref={aim} position={[0, 0.72, 0]}>
        <group position={[0, 0, 0.02]}>
          <mesh geometry={dishGeo} material={m.dish} />
          <mesh position={[0, 0, 0.0]} rotation={Z} material={m.hullDark}><cylinderGeometry args={[0.08, 0.1, 0.06, 16]} /></mesh>
          {/* feed struts */}
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2;
            const r = 0.5;
            const fz = 0.42;
            const mid = new THREE.Vector3(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, (0.12 + fz) / 2);
            const dir = new THREE.Vector3(-Math.cos(a) * r, -Math.sin(a) * r, fz - 0.12).normalize();
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            return (
              <mesh key={i} position={mid} quaternion={q} material={m.metal}>
                <cylinderGeometry args={[0.008, 0.008, Math.hypot(r, fz - 0.12), 6]} />
              </mesh>
            );
          })}
          <mesh ref={feed} position={[0, 0, 0.44]} rotation={Z} material={m.hullDark}>
            <cylinderGeometry args={[0.03, 0.045, 0.08, 12]} />
          </mesh>
          <sprite ref={feedGlow} position={[0, 0, 0.5]}>
            <spriteMaterial map={glowTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      </group>
    </group>
  );
}

function NavLight({ position, color, period, offset = 0 }: { position: [number, number, number]; color: THREE.ColorRepresentation; period: number; offset?: number }) {
  const ref = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = ((clock.elapsedTime + offset) % period) / period;
    const on = p < 0.08 ? 1 : 0.06;
    ref.current.scale.setScalar(0.24 * on + 0.03);
  });
  return (
    <sprite ref={ref} position={position}>
      <spriteMaterial map={glowTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  );
}

export function Spacecraft({ link, name }: { link: LinkVisual; name: string }) {
  const m = useMaterials();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);

  const baseQuat = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(CRAFT_POS);
    o.lookAt(TRAJECTORY.getPoint(Math.min(1, CRAFT_T + 0.02)));
    return o.quaternion.clone();
  }, []);

  const engineGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(new THREE.Vector2(0.16 + Math.pow(t, 1.6) * 0.38, -t * 0.75));
    }
    const g = new THREE.LatheGeometry(pts, 40);
    g.rotateX(Math.PI / 2); // axis Y -> Z, bell opens towards -Z
    return g;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (body.current) {
      body.current.rotation.z = Math.sin(t * 0.18) * 0.06;
      body.current.rotation.x = Math.sin(t * 0.13) * 0.025;
      body.current.position.y = Math.sin(t * 0.4) * 0.05;
    }
    const track = 0.5 + Math.sin(t * 0.1) * 0.12;
    if (wingL.current) wingL.current.rotation.x = track;
    if (wingR.current) wingR.current.rotation.x = track;
  });

  return (
    <group ref={root} position={CRAFT_POS} quaternion={baseQuat}>
      <group ref={body} scale={CRAFT_SCALE}>
        {/* crew capsule */}
        <mesh position={[0, 0, 2.15]} rotation={Z} material={m.hull}>
          <cylinderGeometry args={[0.24, 0.5, 0.6, 40]} />
        </mesh>
        <mesh position={[0, 0, 2.5]} rotation={Z} material={m.hullDark}>
          <cylinderGeometry args={[0.16, 0.22, 0.1, 24]} />
        </mesh>
        {[-0.25, 0, 0.25].map((x, i) => (
          <mesh key={i} position={[x, 0.33, 2.12]} rotation={[-0.45, 0, 0]} material={m.window}>
            <boxGeometry args={[0.1, 0.012, 0.09]} />
          </mesh>
        ))}
        {/* adaptor */}
        <mesh position={[0, 0, 1.76]} rotation={Z} material={m.hullDark}>
          <cylinderGeometry args={[0.5, 0.56, 0.18, 40]} />
        </mesh>
        {/* inflatable habitat */}
        <mesh position={[0, 0, 0.85]} rotation={Z} material={m.fabric}>
          <cylinderGeometry args={[0.6, 0.6, 1.6, 48]} />
        </mesh>
        {[0.12, 0.5, 0.85, 1.2, 1.58].map((z) => (
          <mesh key={z} position={[0, 0, z]} material={m.hullDark}>
            <torusGeometry args={[0.605, 0.022, 10, 64]} />
          </mesh>
        ))}
        {/* cupola windows */}
        {[-0.5, -0.17, 0.17, 0.5].map((a, i) => (
          <mesh key={`w${i}`} position={[Math.sin(a + Math.PI / 2) * 0.606, Math.cos(a + Math.PI / 2) * 0.606, 1.02]} rotation={[0, 0, -(a + Math.PI / 2) + Math.PI / 2]} material={m.window}>
            <boxGeometry args={[0.01, 0.1, 0.13]} />
          </mesh>
        ))}
        {/* node */}
        <mesh position={[0, 0, -0.12]} material={m.hull}>
          <sphereGeometry args={[0.42, 32, 24]} />
        </mesh>
        <mesh position={[0.42, 0, -0.12]} rotation={[0, 0, Math.PI / 2]} material={m.hullDark}>
          <cylinderGeometry args={[0.16, 0.16, 0.12, 24]} />
        </mesh>
        {/* truss */}
        <group position={[0, 0, -1.45]}>
          <Truss m={m} />
        </group>
        {/* solar wings */}
        <group position={[0, 0, -1.55]}>
          <SolarWing side={1} m={m} wingRef={wingR} />
          <SolarWing side={-1} m={m} wingRef={wingL} />
        </group>
        {/* radiators */}
        {[1, -1].map((s) => (
          <group key={s} position={[0, s * 0.9, -0.85]}>
            <mesh material={m.radiator}><boxGeometry args={[0.02, 1.1, 0.62]} /></mesh>
            {[-0.2, 0, 0.2].map((z) => (
              <mesh key={z} position={[0.012, 0, z]} material={m.hullDark}><boxGeometry args={[0.004, 1.06, 0.012]} /></mesh>
            ))}
            <mesh position={[0, -s * 0.6, 0]} material={m.metal}><boxGeometry args={[0.03, 0.14, 0.03]} /></mesh>
          </group>
        ))}
        {/* service module */}
        <mesh position={[0, 0, -2.85]} rotation={Z} material={m.gold}>
          <cylinderGeometry args={[0.62, 0.62, 0.86, 48]} />
        </mesh>
        <mesh position={[0, 0, -2.4]} rotation={Z} material={m.hullDark}>
          <cylinderGeometry args={[0.64, 0.64, 0.05, 48]} />
        </mesh>
        <mesh position={[0, 0, -3.3]} rotation={Z} material={m.hullDark}>
          <cylinderGeometry args={[0.5, 0.64, 0.08, 48]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <group key={i} position={[Math.cos(a) * 0.66, Math.sin(a) * 0.66, -2.65]} rotation={[0, 0, a]}>
              <mesh material={m.metal}><boxGeometry args={[0.08, 0.1, 0.1]} /></mesh>
              <mesh position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.engine}><coneGeometry args={[0.03, 0.06, 8, 1, true]} /></mesh>
            </group>
          );
        })}
        {/* main engine */}
        <group position={[0, 0, -3.33]}>
          <mesh geometry={engineGeo} material={m.engine} />
          <mesh geometry={engineGeo} material={m.engineGlow} scale={[0.96, 0.96, 0.98]} />
        </group>
        <Dish m={m} link={link} />
        <NavLight position={[3.6, 0, -1.55]} color={new THREE.Color(0.2, 2.5, 0.6)} period={2.2} />
        <NavLight position={[-3.6, 0, -1.55]} color={new THREE.Color(2.5, 0.25, 0.25)} period={2.2} />
        <NavLight position={[0, 0.3, 2.45]} color={new THREE.Color(2.5, 2.5, 2.5)} period={1.3} offset={0.4} />
      </group>
      <Html position={[0, -1.25, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="scene-label scene-label--craft">
          <span className="scene-label__dot" />
          {name}
        </div>
      </Html>
    </group>
  );
}
