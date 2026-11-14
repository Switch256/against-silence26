"use client";
// Orbit controls plus slow, eased transitions between three presets:
// Overview, Spacecraft and Ground station (computed from the serving DSN antenna).
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { autoCameraUserMoved } from "@/lib/autoCamera";
import { anchors, CAMERA_VIEWS } from "@/lib/sceneLayout";
import { useStore, type CameraView } from "@/lib/store";

const TRANSITION_S = 2.0;
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const MIN_DISTANCE = 0.4;
const MAX_DISTANCE = 90;

/** Pending button/keyboard zoom: multiply the camera's distance to its target by `factor`, eased. */
const zoomRequest = { factor: 1 };
export function requestZoom(factor: number) {
  zoomRequest.factor *= factor;
}

/** Pull the overview back on narrow (portrait-ish) viewports so Earth and the habitat both fit. */
function overviewFit(aspect: number) {
  const k = THREE.MathUtils.clamp(1.35 / aspect, 0.9, 1.6);
  const { pos, target } = CAMERA_VIEWS.overview;
  return { pos: target.clone().add(pos.clone().sub(target).multiplyScalar(k)), target: target.clone() };
}

function preset(view: CameraView, aspect: number) {
  if (view === "overview") return overviewFit(aspect);
  if (view === "spacecraft") {
    return { pos: anchors.craft.clone().add(CAMERA_VIEWS.spacecraft.pos), target: anchors.craft.clone().add(CAMERA_VIEWS.spacecraft.target) };
  }
  // Ground station: the serving complex on the Earth's disc, the link leaving towards the spacecraft.
  const n = anchors.stationNormal.clone();
  const toCraft = anchors.craft.clone().sub(anchors.station).normalize();
  const side = new THREE.Vector3().crossVectors(n, toCraft).normalize();
  const pos = anchors.station.clone().addScaledVector(n, 3.2).addScaledVector(side, 2.6).addScaledVector(toCraft, -2.2).add(new THREE.Vector3(0, 0.8, 0));
  const target = anchors.station.clone().addScaledVector(toCraft, 1.1).addScaledVector(n, -0.5);
  return { pos, target };
}

export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const view = useStore((s) => s.view);
  const nonce = useStore((s) => s.viewNonce);
  const tool = useStore((s) => s.tool);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // cursor tells which tool is active: open hand to move, arrows to rotate
    const el = gl.domElement;
    el.style.cursor = tool === "pan" ? "grab" : "";
    const down = () => { if (tool === "pan") el.style.cursor = "grabbing"; };
    const up = () => { if (tool === "pan") el.style.cursor = "grab"; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); };
  }, [tool, gl]);
  const anim = useRef<{ t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; view: CameraView } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (first.current) {
      first.current = false;
      const p = preset(view, (camera as THREE.PerspectiveCamera).aspect);
      camera.position.copy(p.pos);
      c.target.copy(p.target);
      c.update();
      return;
    }
    anim.current = { t: 0, fromPos: camera.position.clone(), fromTarget: c.target.clone(), view };
  }, [view, nonce, camera]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => { anim.current = null; autoCameraUserMoved(); };
    c.addEventListener("start", cancel);
    return () => c.removeEventListener("start", cancel);
  }, []);

  const lastCraft = useRef(new THREE.Vector3().copy(anchors.craft));
  const delta = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    // Smooth zoom from the on-screen buttons / keyboard (towards the current target).
    if (c && Math.abs(zoomRequest.factor - 1) > 1e-3) {
      const step = Math.pow(zoomRequest.factor, Math.min(1, dt * 8));
      zoomRequest.factor /= step;
      const offset = camera.position.clone().sub(c.target);
      const dist = THREE.MathUtils.clamp(offset.length() * step, MIN_DISTANCE, MAX_DISTANCE);
      camera.position.copy(c.target).add(offset.setLength(dist));
      c.update();
    }
    // The Spacecraft view rides along with the travelling habitat (also after the user orbits).
    delta.current.subVectors(anchors.craft, lastCraft.current);
    lastCraft.current.copy(anchors.craft);
    if (c && !a && useStore.getState().view === "spacecraft" && delta.current.lengthSq() > 0) {
      camera.position.add(delta.current);
      c.target.add(delta.current);
      c.update();
    }
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / TRANSITION_S);
    const k = easeInOutSine(a.t);
    const to = preset(a.view, (camera as THREE.PerspectiveCamera).aspect); // live, so the ground preset follows the turning Earth
    camera.position.lerpVectors(a.fromPos, to.pos, k);
    c.target.lerpVectors(a.fromTarget, to.target, k);
    c.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.45}
      zoomSpeed={0.9}
      panSpeed={0.5}
      zoomToCursor
      screenSpacePanning
      // Hand tool: one finger / left button moves the view; otherwise it rotates (right button always pans)
      mouseButtons={tool === "pan"
        ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
        : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={tool === "pan" ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN } : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
    />
  );
}
