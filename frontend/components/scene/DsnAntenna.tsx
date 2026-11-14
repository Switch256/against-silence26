"use client";
// NASA Deep Space Network 34 m beam-waveguide antenna (NASA 3D Resources).
// The model is articulated: the "azimuth" node turns about the vertical axis and the
// "elevation" node tips the dish, so the antenna can actually point at the spacecraft.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { enableShadows, MODEL, useNormalizedModel } from "./models";

/** Elevation pivot axis in the elevation node's local frame, and the angle at which the dish faces the zenith. */
const EL_AXIS = new THREE.Vector3(0, 0, 1);
const EL_ZENITH = Math.PI / 2;

interface Pointing {
  /** model azimuth in radians about +Y; 0 = dish faces +Z, positive turns towards +X */
  az: number;
  /** elevation above the horizon in radians */
  el: number;
}

interface Props {
  /** live pointing, read every frame (e.g. from the scene anchors) */
  pointing: () => Pointing;
  /** largest dimension in scene units */
  size?: number;
  shadows?: boolean;
}

export function DsnAntenna({ pointing, size = 1, shadows = false }: Props) {
  const { object, inner } = useNormalizedModel(MODEL.dsn, size, "base");
  const nodes = useMemo(() => {
    let azimuth: THREE.Object3D | null = null;
    let elevation: THREE.Object3D | null = null;
    inner.traverse((o) => {
      if (o.name === "azimuth") azimuth = o;
      if (o.name === "elevation") elevation = o;
    });
    return {
      azimuth: azimuth as THREE.Object3D | null,
      elevation: elevation as THREE.Object3D | null,
      az0: (azimuth as THREE.Object3D | null)?.quaternion.clone() ?? new THREE.Quaternion(),
      el0: (elevation as THREE.Object3D | null)?.quaternion.clone() ?? new THREE.Quaternion(),
    };
  }, [inner]);

  useEffect(() => {
    if (shadows) enableShadows(object);
    object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.roughness = 0.62;
      mat.metalness = 0.05;
    });
  }, [object, shadows]);

  const cur = useRef<Pointing>(pointing());
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, dt) => {
    // Slew smoothly, the way a real antenna does (a few degrees per second).
    const { az, el } = pointing();
    const k = Math.min(1, dt * 1.2);
    cur.current.az += (((az - cur.current.az + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
    cur.current.el += (el - cur.current.el) * k;
    if (nodes.azimuth) nodes.azimuth.quaternion.copy(nodes.az0).multiply(q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, cur.current.az));
    if (nodes.elevation) nodes.elevation.quaternion.copy(nodes.el0).multiply(q.setFromAxisAngle(EL_AXIS, EL_ZENITH - Math.max(0.1, cur.current.el)));
  });

  return <primitive object={object} />;
}
