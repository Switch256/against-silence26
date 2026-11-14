"use client";
// NASA 3D Resources models (public/models, see SOURCES.md). They are Draco-compressed;
// the decoder is served locally from public/draco so the demo works offline.
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { BASE_PATH } from "@/lib/config";

export const DRACO_PATH = `${BASE_PATH}/draco/`;
export const MODEL = {
  iss: `${BASE_PATH}/models/iss.glb`,
  dsn: `${BASE_PATH}/models/dsn-34m.glb`,
  astronaut: `${BASE_PATH}/models/astronaut.glb`,
  dsn70: `${BASE_PATH}/models/dsn-70m.glb`,
  mro: `${BASE_PATH}/models/mro.glb`,
  tdrs: `${BASE_PATH}/models/tdrs.glb`,
  lro: `${BASE_PATH}/models/lro.glb`,
} as const;

/** NASA imagery (public/textures/nasa, see ATTRIBUTIONS.md). */
export const NASA_TEXTURE = {
  marsMap: `${BASE_PATH}/textures/nasa/mars_nasa_3d_resources.jpg`,
  moonMap: `${BASE_PATH}/textures/nasa/moon_lroc_color_1k.jpg`,
  earthNight: `${BASE_PATH}/textures/nasa/earth_black_marble_2012_3600.jpg`,
} as const;

/** Preload what the first frame needs; the small orbiters load lazily behind Suspense. */
export function preloadModels() {
  [MODEL.iss, MODEL.dsn, MODEL.astronaut].forEach((url) => useGLTF.preload(url, DRACO_PATH));
}

/**
 * Load a model, clone it (the same glTF may appear in several canvases), centre it and scale it
 * so its largest dimension equals `size`. Returns the prepared root and its normalised bounds.
 */
export function useNormalizedModel(url: string, size: number, align: "center" | "base" = "center") {
  const gltf = useGLTF(url, DRACO_PATH);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      }
    });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const dims = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dims.x, dims.y, dims.z);
    const center = box.getCenter(new THREE.Vector3());
    const wrapper = new THREE.Group();
    root.position.set(-center.x, align === "base" ? -box.min.y : -center.y, -center.z);
    wrapper.add(root);
    wrapper.scale.setScalar(k);
    return { object: wrapper, inner: root, dims: dims.multiplyScalar(k) };
  }, [gltf, size, align]);
}

/** Apply shadows to every mesh of a model. */
export function enableShadows(obj: THREE.Object3D, cast = true, receive = true) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}
