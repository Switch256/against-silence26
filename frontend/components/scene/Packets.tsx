"use client";
// PulseBrief bundles as glowing packets.
//  - queued bundles stack up beside the spacecraft (the on-board outbox, store-and-forward)
//  - departing bundles fly from their slot to the antenna, then along the beam to the DSN station
//  - Earth replies fly the other way as green packets
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Layer } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { anchors, CRAFT_POS } from "@/lib/sceneLayout";
import { now, useStore, type Flight } from "@/lib/store";
import { glowTexture, ringTexture } from "./textures";

// The on-board outbox: a column of held packets just above and Earth-side of the spacecraft.
const STACK_ORIGIN = CRAFT_POS.clone().add(new THREE.Vector3(-1.5, 0.9, 1.0));
const STACK_STEP = 0.3;
const PER_COLUMN = 6;

/** The rack scales with camera distance so it reads the same in every view (updated per frame). */
let stackScale = 1;
const zoomScale = (d: number) => THREE.MathUtils.clamp(d / 28, 0.28, 1.3);

function slotLocal(i: number, out = new THREE.Vector3()) {
  const col = Math.floor(i / PER_COLUMN);
  const row = i % PER_COLUMN;
  return out.set(-col * 0.55, row * STACK_STEP, 0);
}
function slotPosition(i: number, out = new THREE.Vector3()) {
  return slotLocal(i, out).multiplyScalar(stackScale).add(STACK_ORIGIN);
}

const hdr = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);
const LAYER_HDR: Record<Layer | "reply", THREE.Color> = {
  headline: hdr(COLORS.headline, 3),
  context: hdr(COLORS.context, 2.6),
  evidence: hdr(COLORS.evidence, 3),
  reply: hdr(COLORS.reply, 2.6),
};

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

function flightPos(f: Flight, p: number, out: THREE.Vector3, tmp: THREE.Vector3) {
  if (f.kind === "bundle") {
    const from = slotPosition(f.fromSlot, tmp);
    if (p <= 0) return out.copy(from);
    if (p < 0.16) return out.lerpVectors(from, anchors.dish, ease(p / 0.16));
    return out.lerpVectors(anchors.dish, anchors.station, easeSine((p - 0.16) / 0.84));
  }
  const start = tmp.copy(anchors.station).addScaledVector(anchors.stationNormal, 0.35);
  if (p <= 0) return out.copy(start);
  if (p < 0.9) return out.lerpVectors(start, anchors.dish, easeSine(p / 0.9));
  return out.lerpVectors(anchors.dish, CRAFT_POS, ease((p - 0.9) / 0.1));
}

const wpos = new THREE.Vector3();

/** Data-packet mesh: a faceted core with a soft halo. Keeps a readable on-screen size at any zoom. */
function PacketBody({ color, scale = 1, fixed = false }: { color: THREE.Color; scale?: number; fixed?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (!ref.current || fixed) return;
    ref.current.getWorldPosition(wpos);
    ref.current.scale.setScalar(scale * zoomScale(wpos.distanceTo(camera.position)));
  });
  return (
    <group ref={ref} scale={scale}>
      <mesh>
        <octahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <sprite scale={[0.7, 0.7, 1]}>
        <spriteMaterial map={glowTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.7} />
      </sprite>
    </group>
  );
}

const TRAIL = 7;

function FlyingPacket({ flight }: { flight: Flight }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const trail = useRef<(THREE.Sprite | null)[]>([]);
  const burst = useRef<THREE.Sprite>(null);
  const color = LAYER_HDR[flight.kind === "reply" ? "reply" : flight.layer ?? "headline"];
  const v = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }) => {
    const p = (now() - flight.start) / flight.duration;
    const landed = p >= 1;
    if (body.current) {
      flightPos(flight, Math.min(1, p), v, tmp);
      body.current.position.copy(v);
      body.current.visible = !landed;
      body.current.rotation.set(clock.elapsedTime * 2, clock.elapsedTime * 3, 0);
    }
    trail.current.forEach((s, i) => {
      if (!s) return;
      const pp = p - (i + 1) * 0.018;
      const show = pp > 0.16 && !landed && flight.kind === "bundle" ? 1 : flight.kind === "reply" && pp > 0 && !landed ? 1 : 0;
      flightPos(flight, Math.min(1, Math.max(0, pp)), v, tmp);
      s.position.copy(v);
      const k = (1 - i / TRAIL) * show * zoomScale(v.distanceTo(camera.position));
      s.scale.setScalar(0.5 * k + 0.0001);
      (s.material as THREE.SpriteMaterial).opacity = 0.5 * k;
    });
    if (burst.current) {
      const b = (now() - flight.start - flight.duration) / 0.6;
      const on = b >= 0 && b <= 1;
      burst.current.visible = on;
      if (on) {
        burst.current.position.copy(flight.kind === "bundle" ? anchors.station : anchors.dish);
        burst.current.scale.setScalar(0.3 + b * 2.2);
        (burst.current.material as THREE.SpriteMaterial).opacity = 1 - b;
      }
    }
  });

  return (
    <group ref={group}>
      <group ref={body}>
        <PacketBody color={color} />
      </group>
      {Array.from({ length: TRAIL }).map((_, i) => (
        <sprite key={i} ref={(el) => { trail.current[i] = el; }}>
          <spriteMaterial map={glowTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      <sprite ref={burst} visible={false}>
        <spriteMaterial map={ringTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}

function QueuedPacket({ index, layer }: { index: number; layer: Layer }) {
  const ref = useRef<THREE.Group>(null);
  const target = useMemo(() => slotLocal(index), [index]);
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.lerp(target, Math.min(1, dt * 6));
    ref.current.position.y += Math.sin(t * 2 + index) * 0.0015;
    ref.current.rotation.y = t * 0.8 + index;
  });
  return (
    <group ref={ref} position={[0.6, -0.4, 0]}>
      <PacketBody color={LAYER_HDR[layer]} scale={0.85} fixed />
    </group>
  );
}

function OutboxRack({ queued }: { queued: { id: string; layer: Layer }[] }) {
  const group = useRef<THREE.Group>(null);
  const count = queued.length;
  const rows = Math.min(count, PER_COLUMN);
  const cols = Math.ceil(count / PER_COLUMN);
  const lineGeo = useMemo(() => {
    const pts: number[] = [];
    for (let c = 0; c < cols; c++) {
      const a = slotLocal(c * PER_COLUMN).add(new THREE.Vector3(0, -0.24, 0));
      const b = slotLocal(c * PER_COLUMN + Math.min(PER_COLUMN, count - c * PER_COLUMN) - 1).add(new THREE.Vector3(0, 0.24, 0));
      pts.push(a.x - 0.2, a.y, a.z, a.x + 0.2, a.y, a.z, a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [count, cols]);
  const side = useMemo(() => new THREE.Vector3(-0.35 - 0.55 * (cols - 1), ((rows - 1) * STACK_STEP) / 2, 0), [rows, cols]);

  useFrame(({ camera }) => {
    stackScale = zoomScale(STACK_ORIGIN.distanceTo(camera.position));
    group.current?.scale.setScalar(stackScale);
  });

  return (
    <group ref={group} position={STACK_ORIGIN}>
      {queued.map((q, i) => (
        <QueuedPacket key={q.id} index={i} layer={q.layer} />
      ))}
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color="#ffb27a" transparent opacity={0.45} />
      </lineSegments>
      <Html position={side} zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
        <div className="outbox-flag" style={{ transform: "translate(calc(-100% - 6px), -50%)" }}>
          <div>
            <b>{count}</b> held on board
          </div>
          <span>store &amp; forward · BPv7</span>
        </div>
      </Html>
    </group>
  );
}

function EarthQueue({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.position.copy(anchors.station).addScaledVector(anchors.stationNormal, 0.4);
  });
  return (
    <group ref={group}>
      {Array.from({ length: count }).map((_, i) => (
        <group key={i} position={[0, i * 0.4, 0]}>
          <PacketBody color={LAYER_HDR.reply} scale={0.85} />
        </group>
      ))}
      <Html position={[0, count * 0.4 + 0.3, 0]} center zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
        <div className="outbox-flag outbox-flag--reply">
          reply waiting
          <span>sends when the link opens</span>
        </div>
      </Html>
    </group>
  );
}

export function Packets() {
  const flights = useStore((s) => s.flights);
  const outbox = useStore((s) => s.outbox);
  const earthQueue = useStore((s) => s.earthQueue);
  const flyingIds = new Set(flights.map((f) => f.id));
  const queued = outbox.filter((q) => !flyingIds.has(q.id));

  return (
    <group>
      {queued.length > 0 && <OutboxRack queued={queued} />}
      {flights.map((f) => (
        <FlyingPacket key={f.id} flight={f} />
      ))}
      {earthQueue.length > 0 && <EarthQueue count={earthQueue.length} />}
    </group>
  );
}
