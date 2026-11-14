"use client";
// Orbit controls plus eased transitions between cinematic presets.
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CAMERA_VIEWS } from "@/lib/sceneLayout";
import { useStore } from "@/lib/store";

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const view = useStore((s) => s.view);
  const nonce = useStore((s) => s.viewNonce);
  const anim = useRef<{ t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3 } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const preset = CAMERA_VIEWS[view];
    if (first.current) {
      // Opening shot: drift in from further out.
      first.current = false;
      camera.position.copy(preset.pos).multiplyScalar(1.35).add(new THREE.Vector3(0, 3, 0));
      c.target.copy(preset.target);
    }
    anim.current = {
      t: 0,
      fromPos: camera.position.clone(),
      fromTarget: c.target.clone(),
      toPos: preset.pos.clone(),
      toTarget: preset.target.clone(),
    };
  }, [view, nonce, camera]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => (anim.current = null);
    c.addEventListener("start", cancel);
    return () => c.removeEventListener("start", cancel);
  }, []);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / 2.4);
    const k = easeInOut(a.t);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    c.target.lerpVectors(a.fromTarget, a.toTarget, k);
    c.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
      panSpeed={0.6}
      minDistance={1.5}
      maxDistance={120}
    />
  );
}
