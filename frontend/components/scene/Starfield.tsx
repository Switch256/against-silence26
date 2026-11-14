"use client";
// Background sky: a sparse, dim, static star catalogue-like field and a small Sun disc.
// No twinkle, no nebula: stars are only context.
import { useMemo } from "react";
import * as THREE from "three";
import { SUN_DIR } from "@/lib/sceneLayout";
import { glowTexture } from "./textures";

const STAR_COUNT = 1800;
const R = 600;

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
    v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(R);
    pos.set([v.x, v.y, v.z], i * 3);
    // magnitude-like distribution: most stars faint, a few brighter
    const m = Math.pow(rand(), 3.2);
    const t = rand();
    c.setHSL(t < 0.15 ? 0.09 : 0.6, t < 0.15 ? 0.35 : 0.12, 0.85);
    const b = 0.22 + m * 0.7;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = 1.0 + m * 1.6;
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
        float a = smoothstep(0.5, 0.15, d);
        gl_FragColor = vec4(vColor, a);
      }`,
  });

export function Starfield() {
  const geo = useMemo(makeStars, []);
  const mat = useMemo(starMaterial, []);
  const sun = useMemo(() => SUN_DIR.clone().multiplyScalar(420), []);
  return (
    <group>
      <points geometry={geo} material={mat} renderOrder={-9} frustumCulled={false} />
      <sprite position={sun} scale={[22, 22, 1]}>
        <spriteMaterial map={glowTexture()} color={[1.6, 1.5, 1.35]} depthWrite={false} toneMapped={false} transparent />
      </sprite>
    </group>
  );
}
