"use client";
// AEGIS-1, the crewed habitat: aegis1.glb, prepared in Blender from NASA's ISS (B) model
// (tools/blender/prep_aegis1.py): named PBR materials and two alpha-joint pivots, so the arrays
// track the Sun live, as in the rendered film. Navigation lights (port red, starboard green, white
// double-flash strobe) glow through the bloom pass. A recent crew alert pulses a beacon on the
// habitat in its severity colour, the same rule as the crew body view.
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "@/lib/constants";
import { anchors, CRAFT_SIZE, craftT, SUN_DIR, TRAJECTORY } from "@/lib/sceneLayout";
import { useStore } from "@/lib/store";
import { DRACO_PATH, MODEL } from "./models";

/** HDR colour for an emissive marker (values above 1 feed the bloom). */
const glow = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

interface Rig {
  object: THREE.Group;
  pivots: THREE.Object3D[];
  port: THREE.MeshBasicMaterial;
  starboard: THREE.MeshBasicMaterial;
  strobe: THREE.MeshBasicMaterial;
  beacon: THREE.Mesh;
}

function useAegisModel(): Rig {
  const gltf = useGLTF(MODEL.aegis1, DRACO_PATH);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // no environment map in the live scene: keep metals from going black
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.metalness = Math.min(mat.metalness ?? 0, 0.35);
      mat.side = THREE.DoubleSide;
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
    });

    // navigation lights in model metres (truss along Z at y = 10.8; port = +Z)
    const lamp = (color: THREE.Color, pos: [number, number, number], r = 0.45) => {
      const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
      mesh.position.set(...pos);
      root.add(mesh);
      return { mat, mesh };
    };
    const port = lamp(glow("#ff2a1a", 6), [0, 10.8, 23.3]).mat;
    const starboard = lamp(glow("#22ff66", 6), [0, 10.8, -23.1]).mat;
    const strobe = lamp(glow("#ffffff", 10), [0, 16.6, 0], 0.4).mat;
    const beacon = lamp(glow(COLORS.warning, 8), [1.6, 6.5, 0], 0.9).mesh;
    beacon.visible = false;

    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.visible) box.expandByObject(o);
    });
    const dims = box.getSize(new THREE.Vector3());
    root.position.sub(box.getCenter(new THREE.Vector3()));
    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(CRAFT_SIZE / Math.max(dims.x, dims.y, dims.z));

    const pivots = ["array_port", "array_starboard"].map((n) => root.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
    return { object: wrapper, pivots, port, starboard, strobe, beacon };
  }, [gltf]);
}

/** Mission time in seconds, interpolated between polls. */
function missionSeconds() {
  const { mission, lastUpdate } = useStore.getState();
  if (mission?.mission_time_s == null) return 0;
  return mission.mission_time_s + Math.max(0, (Date.now() - (lastUpdate || Date.now())) / 1000);
}

/** Severity of a crew alert (not space weather) raised in the last 2 minutes of telemetry. */
function recentCrewAlert() {
  const sc = useStore.getState().spacecraft;
  if (!sc) return null;
  const last = sc.readings.at(-1);
  const a = [sc.latest_alert, ...(sc.alerts ?? [])].find((x) => x && x.metric !== "space_weather");
  if (!a?.ts || !last) return null;
  return Date.parse(last.ts) - Date.parse(a.ts) < 2 * 60_000 ? a.severity : null;
}

const NAV_ON = 1;
const NAV_OFF = 0.08;
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

export function Spacecraft({ name }: { name: string }) {
  const rig = useAegisModel();
  const group = useRef<THREE.Group>(null);
  const attitude = useRef<THREE.Group>(null);
  const t = useRef<number | null>(null);
  const portBase = useMemo(() => rig.port.color.clone(), [rig]);
  const stbdBase = useMemo(() => rig.starboard.color.clone(), [rig]);
  const strobeBase = useMemo(() => rig.strobe.color.clone(), [rig]);
  const warn = useMemo(() => glow(COLORS.warning, 8), []);
  const caution = useMemo(() => glow(COLORS.caution, 7), []);
  // Base attitude: truss roughly perpendicular to the Sun line.
  const base = useMemo(() => new THREE.Euler(0.18, -0.55, 0.12), []);

  useFrame(({ clock }, dt) => {
    // Travel along the transfer arc with mission time (eased, so a reset glides back rather than jumps).
    const target = craftT(missionSeconds());
    t.current = t.current === null ? target : t.current + (target - t.current) * Math.min(1, dt * 0.5);
    TRAJECTORY.getPoint(t.current, anchors.craft);
    anchors.craftT = t.current;
    group.current?.position.copy(anchors.craft);

    const s = clock.elapsedTime;
    attitude.current?.rotation.set(base.x + Math.sin(s * 0.05) * 0.05, base.y + Math.sin(s * 0.031) * 0.09, base.z + Math.sin(s * 0.043) * 0.04);

    // Solar arrays: roll each side about the truss (local Z) so the blanket normal (local ±X) faces the Sun.
    for (const p of rig.pivots) {
      p.parent!.getWorldQuaternion(tmpQ).invert();
      tmpV.copy(SUN_DIR).applyQuaternion(tmpQ);
      const want = Math.atan2(tmpV.y, tmpV.x);
      let d = want - p.rotation.z;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest way round
      p.rotation.z += d * Math.min(1, dt * 0.6);
    }

    // Nav lights: steady-ish pulse, alternating sides; strobe double-flash every 2 s.
    const ph = s % 1.6;
    rig.port.color.copy(portBase).multiplyScalar(ph < 0.8 ? NAV_ON : NAV_OFF);
    rig.starboard.color.copy(stbdBase).multiplyScalar(ph >= 0.8 ? NAV_ON : NAV_OFF);
    const st = s % 2;
    rig.strobe.color.copy(strobeBase).multiplyScalar((st < 0.06 || (st > 0.2 && st < 0.26)) ? 1 : 0);

    // Alert beacon: a slow, soft pulse while a crew alert is recent.
    const sev = recentCrewAlert();
    rig.beacon.visible = sev === "urgent" || sev === "review";
    if (rig.beacon.visible) {
      const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s * (sev === "urgent" ? 5 : 3)));
      (rig.beacon.material as THREE.MeshBasicMaterial).color.copy(sev === "urgent" ? warn : caution).multiplyScalar(k);
    }
  });

  return (
    <group ref={group}>
      <group ref={attitude}>
        <primitive object={rig.object} />
      </group>
      <Html position={[0, -1.6, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="scene-label" title="Crewed habitat, drawn with the NASA ISS model (prepared in Blender)">
          <b>{name}</b> NASA ISS model
        </div>
      </Html>
    </group>
  );
}
