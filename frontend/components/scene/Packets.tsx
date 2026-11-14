"use client";
// PulseBrief bundles on the link, in the colours of the Blender film (HDR, so they glow in the bloom):
//  headline = warning red, context = caution amber, evidence = accent blue; Earth replies = nominal green.
//  - queued bundles: glowing orbs stacked beside the habitat (one per bundle, by layer), with a counter
//  - bundles in flight: small markers moving along the link, launched in sent_at order;
//    a marker waits short of Earth until the backend reports delivered_at
//  - Earth replies: the same marker, travelling the other way
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "@/lib/constants";
import { fmtBytes } from "@/lib/format";
import { anchors } from "@/lib/sceneLayout";
import type { Layer } from "@/lib/api";
import { now, useStore, type Flight, type QueuedPacket } from "@/lib/store";
import { linkEarthEnd } from "./LinkLine";

/** The on-board outbox sits just Earth-side of the habitat and travels with it. */
const STACK_OFFSET = new THREE.Vector3(-1.7, -0.45, 0.7);
const stackOrigin = (out: THREE.Vector3) => out.copy(anchors.craft).add(STACK_OFFSET);
const PLATE_GAP = 0.2;
const MAX_PLATES = 12;

/** Keep markers a readable, constant on-screen size at any zoom. */
const screenScale = (d: number) => THREE.MathUtils.clamp(d / 24, 0.18, 1.6);
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

const LAYER_GLOW: Record<Layer, THREE.Color> = {
  headline: new THREE.Color(COLORS.warning).multiplyScalar(3.2),
  context: new THREE.Color(COLORS.caution).multiplyScalar(2.8),
  evidence: new THREE.Color(COLORS.accent).multiplyScalar(3.0),
};
const REPLY_GLOW = new THREE.Color(COLORS.nominal).multiplyScalar(3.0);
const packetGlow = (kind: "bundle" | "reply", layer?: Layer) => (kind === "reply" ? REPLY_GLOW : LAYER_GLOW[layer ?? "headline"]);

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

const TRAIL = [0.035, 0.07, 0.105];

function FlyingPacket({ flight }: { flight: Flight }) {
  const group = useRef<THREE.Group>(null);
  const color = packetGlow(flight.kind, flight.layer);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const raw = (now() - flight.start) / flight.duration;
    g.visible = raw >= 0 && raw < 1.02;
    const from = flight.kind === "bundle" ? stackOrigin(tmpA) : linkEarthEnd(tmpA);
    const to = flight.kind === "bundle" ? linkEarthEnd(tmpB) : tmpB.copy(anchors.craft);
    const cap = flight.delivered ? 1 : 0.94;
    g.children.forEach((c, i) => {
      const p = Math.min(raw - (i === 0 ? 0 : TRAIL[i - 1]), cap);
      c.position.lerpVectors(from, to, easeInOut(Math.max(0, p)));
      c.scale.setScalar(screenScale(c.position.distanceTo(camera.position)) * (1 - i * 0.22));
    });
  });
  return (
    <group ref={group} visible={false}>
      <mesh>
        <sphereGeometry args={[0.075, 16, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {TRAIL.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 12, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.45 - i * 0.13} />
        </mesh>
      ))}
    </group>
  );
}

/** One held bundle: pops in, then breathes gently while it waits for the link. */
function Orb({ index, geo, color }: { index: number; geo: THREE.BufferGeometry; color: THREE.Color }) {
  const ref = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const s = clock.elapsedTime;
    born.current ??= s;
    const pop = Math.min(1, (s - born.current) / 0.35);
    const k = pop < 1 ? 0.3 + 0.7 * pop + 0.25 * Math.sin(Math.PI * pop) : 1 + 0.06 * Math.sin(s * 2.4 + index);
    m.scale.setScalar(k);
  });
  return (
    <mesh ref={ref} geometry={geo} position={[0, index * PLATE_GAP, 0]}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function OutboxStack({ queued }: { queued: QueuedPacket[] }) {
  const group = useRef<THREE.Group>(null);
  const bytes = queued.reduce((n, q) => n + q.size, 0);
  const plates = Math.min(queued.length, MAX_PLATES);
  const geo = useMemo(() => new THREE.SphereGeometry(0.085, 16, 12), []);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    stackOrigin(g.position);
    g.scale.setScalar(screenScale(g.position.distanceTo(camera.position)) * 1.4);
  });
  return (
    <group ref={group}>
      {queued.slice(0, plates).map((q, i) => (
        <Orb key={q.id} index={i} geo={geo} color={LAYER_GLOW[q.layer]} />
      ))}
      <Html position={[0, plates * PLATE_GAP + 0.08, 0]} zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
        <div className="scene-callout" style={{ transform: "translate(-50%, calc(-100% - 4px))" }}>
          <strong className="num">{queued.length} bundle{queued.length === 1 ? "" : "s"} held on board</strong>
          <span className="num">{fmtBytes(bytes)} · store and forward</span>
        </div>
      </Html>
    </group>
  );
}

function EarthQueue({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) linkEarthEnd(group.current.position).addScaledVector(anchors.stationNormal, 0.25);
  });
  return (
    <group ref={group}>
      <Html center zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
        <div className="scene-callout" style={{ transform: "translateY(-100%)" }}>
          <strong className="num">{count} repl{count === 1 ? "y" : "ies"} waiting on Earth</strong>
          <span>Sends when the link opens</span>
        </div>
      </Html>
    </group>
  );
}

export function Packets() {
  const flights = useStore((s) => s.flights);
  const outbox = useStore((s) => s.outbox);
  const earthQueue = useStore((s) => s.earthQueue);
  const flying = new Set(flights.map((f) => f.id));
  const queued = outbox.filter((q) => !flying.has(q.id));
  return (
    <group>
      {queued.length > 0 && <OutboxStack queued={queued} />}
      {flights.map((f) => (
        <FlyingPacket key={f.id} flight={f} />
      ))}
      {earthQueue.length > 0 && <EarthQueue count={earthQueue.length} />}
    </group>
  );
}
