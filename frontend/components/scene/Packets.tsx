"use client";
// PulseBrief bundles on the link, kept deliberately understated:
//  - queued bundles: a neat stack of small plates beside the habitat, with a counter
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
import { now, useStore, type Flight, type QueuedPacket } from "@/lib/store";
import { linkEarthEnd } from "./LinkLine";

/** The on-board outbox sits just Earth-side of the habitat and travels with it. */
const STACK_OFFSET = new THREE.Vector3(-1.7, -0.45, 0.7);
const stackOrigin = (out: THREE.Vector3) => out.copy(anchors.craft).add(STACK_OFFSET);
const PLATE_GAP = 0.075;
const MAX_PLATES = 12;

/** Keep markers a readable, constant on-screen size at any zoom. */
const screenScale = (d: number) => THREE.MathUtils.clamp(d / 24, 0.18, 1.6);
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

const BUNDLE_COLOR = new THREE.Color(COLORS.accent).multiplyScalar(1.15);
const REPLY_COLOR = new THREE.Color("#e8eaeb");

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

function FlyingPacket({ flight }: { flight: Flight }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    const raw = (now() - flight.start) / flight.duration;
    const p = Math.min(raw, flight.delivered ? 1 : 0.94);
    m.visible = raw >= 0 && raw < 1.02;
    const from = flight.kind === "bundle" ? stackOrigin(tmpA) : linkEarthEnd(tmpA);
    const to = flight.kind === "bundle" ? linkEarthEnd(tmpB) : tmpB.copy(anchors.craft);
    m.position.lerpVectors(from, to, easeInOut(Math.max(0, p)));
    m.scale.setScalar(screenScale(m.position.distanceTo(camera.position)));
  });
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.07, 16, 12]} />
      <meshBasicMaterial color={flight.kind === "bundle" ? BUNDLE_COLOR : REPLY_COLOR} toneMapped={false} />
    </mesh>
  );
}

function OutboxStack({ queued }: { queued: QueuedPacket[] }) {
  const group = useRef<THREE.Group>(null);
  const bytes = queued.reduce((n, q) => n + q.size, 0);
  const plates = Math.min(queued.length, MAX_PLATES);
  const geo = useMemo(() => new THREE.BoxGeometry(0.26, 0.04, 0.18), []);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    stackOrigin(g.position);
    g.scale.setScalar(screenScale(g.position.distanceTo(camera.position)) * 1.4);
  });
  return (
    <group ref={group}>
      {Array.from({ length: plates }).map((_, i) => (
        <mesh key={i} geometry={geo} position={[0, i * PLATE_GAP, 0]}>
          <meshBasicMaterial color={i === plates - 1 ? "#c9d8ea" : "#8ea3ba"} toneMapped={false} />
        </mesh>
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
