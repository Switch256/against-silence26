"use client";
// Background sky, two layers, both infinitely far (they follow the camera):
//  1. NASA SVS Deep Star Maps 2020 (svs.gsfc.nasa.gov/4851), starmap_2020_4k: the real star catalogue
//     (Hipparcos-2, Tycho-2, Gaia DR2) with the Milky Way and its dust lanes; slight black-level cut;
//  2. a few crisp point stars on top for sharpness.
// Plus a small Sun disc. Kept calm: context, not decoration.
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SUN_DIR } from "@/lib/sceneLayout";
import { NASA_TEXTURE } from "./models";
import { glowTexture } from "./textures";

const SKY_R = 1500;
const STAR_R = 1400;
const STAR_COUNT = 1500;          // a few crisp stars over the real star map
/** Celestial sphere orientation: galactic centre ahead of the overview camera, band laid diagonally. */
const SKY_ROT = new THREE.Euler(0.12, 0.25, -0.42);

/** Deterministic pseudo-random numbers so the sky is the same on every load. */
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function makeStars() {
  const rand = rng(42);
  const pos = new Float32Array(STAR_COUNT * 3);
  const col = new Float32Array(STAR_COUNT * 3);
  const size = new Float32Array(STAR_COUNT);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < STAR_COUNT; i++) {
    v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(STAR_R);
    pos.set([v.x, v.y, v.z], i * 3);
    const m = Math.pow(rand(), 4);                 // most stars faint, a few bright
    const t = rand();
    c.setHSL(t < 0.18 ? 0.08 : t < 0.3 ? 0.13 : 0.6, t < 0.3 ? 0.4 : 0.15, 0.86);
    const b = 0.18 + m * 1.1;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = 0.9 + m * 2.2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("size", new THREE.BufferAttribute(size, 1));
  return g;
}

const starMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute float size; attribute vec3 color; varying vec3 vColor;
      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vColor, smoothstep(0.5, 0.12, d));
      }`,
  });

/** Milky Way with a black-level cut and gain (sRGB texture, decoded to linear by three). */
const skyMaterial = (map: THREE.Texture) =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: { map: { value: map }, uFloor: { value: 0.006 }, uGain: { value: 0.62 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uFloor; uniform float uGain; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(map, vUv).rgb;
        c = max(c - uFloor, 0.0) * uGain;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

export function Starfield() {
  const map = useTexture(NASA_TEXTURE.sky);
  const skyMat = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return skyMaterial(map);
  }, [map]);
  const geo = useMemo(makeStars, []);
  const starMat = useMemo(starMaterial, []);
  const sky = useRef<THREE.Group>(null);
  const sun = useRef<THREE.Sprite>(null);
  useFrame(({ camera }) => {
    sky.current?.position.copy(camera.position);
    sun.current?.position.copy(camera.position).addScaledVector(SUN_DIR, 900);
  });
  return (
    <group>
      <group ref={sky} rotation={SKY_ROT}>
        {/* scale -x: seen from inside, so the map is not mirrored */}
        <mesh material={skyMat} scale={[-1, 1, 1]} renderOrder={-11} frustumCulled={false}>
          <sphereGeometry args={[SKY_R, 64, 32]} />
        </mesh>
        <points geometry={geo} material={starMat} renderOrder={-10} frustumCulled={false} />
      </group>
      <sprite ref={sun} scale={[48, 48, 1]} renderOrder={-9}>
        <spriteMaterial map={glowTexture()} color={[1.6, 1.5, 1.35]} depthWrite={false} toneMapped={false} transparent />
      </sprite>
    </group>
  );
}
