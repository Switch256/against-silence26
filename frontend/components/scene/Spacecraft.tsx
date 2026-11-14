"use client";
// AEGIS-1, the crewed habitat. Rendered with NASA's International Space Station (B) model
// (NASA 3D Resources) and labelled honestly as such.
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { anchors, CRAFT_SIZE, craftT, TRAJECTORY } from "@/lib/sceneLayout";
import { useStore } from "@/lib/store";
import { DRACO_PATH, MODEL } from "./models";

/** Parts of this model whose transforms are not usable (they float above the station): hidden. */
const DETACHED = /^(bendedtru|pCylinder)/;

function useIssModel() {
  const gltf = useGLTF(MODEL.iss, DRACO_PATH);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    const hull = new THREE.MeshStandardMaterial({ color: "#d4d7da", roughness: 0.55, metalness: 0.15 });
    const array = new THREE.MeshStandardMaterial({ color: "#5b4a2c", roughness: 0.38, metalness: 0.35, side: THREE.DoubleSide });
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (DETACHED.test(m.name) || DETACHED.test(m.parent?.name ?? "")) {
        m.visible = false;
        return;
      }
      m.geometry.computeBoundingBox();
      const s = m.geometry.boundingBox!.getSize(new THREE.Vector3());
      // the large, paper-thin planar meshes are the photovoltaic arrays
      const dmax = Math.max(s.x, s.y, s.z);
      const isArray = Math.min(s.x, s.y, s.z) < dmax * 0.03 && dmax > 0;
      m.material = isArray ? array : hull;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.visible) box.expandByObject(o);
    });
    const dims = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(CRAFT_SIZE / Math.max(dims.x, dims.y, dims.z));
    return wrapper;
  }, [gltf]);
}

/** Mission time in seconds, interpolated between polls. */
function missionSeconds() {
  const { mission, lastUpdate } = useStore.getState();
  if (mission?.mission_time_s == null) return 0;
  return mission.mission_time_s + Math.max(0, (Date.now() - (lastUpdate || Date.now())) / 1000);
}

export function Spacecraft({ name }: { name: string }) {
  const model = useIssModel();
  const group = useRef<THREE.Group>(null);
  const attitude = useRef<THREE.Group>(null);
  const t = useRef<number | null>(null);
  // Base attitude: truss roughly perpendicular to the Sun line, arrays facing the Sun.
  const base = useMemo(() => new THREE.Euler(0.18, -0.55, 0.12), []);

  useFrame(({ clock }, dt) => {
    // Travel along the transfer arc with mission time (eased, so a reset glides back rather than jumps).
    const target = craftT(missionSeconds());
    t.current = t.current === null ? target : t.current + (target - t.current) * Math.min(1, dt * 0.5);
    TRAJECTORY.getPoint(t.current, anchors.craft);
    anchors.craftT = t.current;
    group.current?.position.copy(anchors.craft);
    // Gentle attitude drift (a few degrees, minutes-long periods).
    const s = clock.elapsedTime;
    attitude.current?.rotation.set(base.x + Math.sin(s * 0.05) * 0.05, base.y + Math.sin(s * 0.031) * 0.09, base.z + Math.sin(s * 0.043) * 0.04);
  });

  return (
    <group ref={group}>
      <group ref={attitude}>
        <primitive object={model} />
      </group>
      <Html position={[0, -1.5, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="scene-label" title="Crewed habitat, drawn with the NASA ISS model">
          <b>{name}</b> NASA ISS model
        </div>
      </Html>
    </group>
  );
}
