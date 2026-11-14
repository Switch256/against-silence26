"use client";
// Deep-space backdrop: twinkling stars with a faint galactic band, a subtle nebula sky, and the Sun.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SUN_DIR } from "@/lib/sceneLayout";
import { glowTexture } from "./textures";

const STAR_COUNT = 7000;
const BAND_COUNT = 9000;
const R = 600;

function makeStars() {
  const total = STAR_COUNT + BAND_COUNT;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const size = new Float32Array(total);
  const phase = new Float32Array(total);
  const v = new THREE.Vector3();
  const bandNormal = new THREE.Vector3(0.35, 1, -0.25).normalize();
  const bandU = new THREE.Vector3(1, 0, 0).cross(bandNormal).normalize();
  const bandV = bandNormal.clone().cross(bandU);
  const c = new THREE.Color();
  for (let i = 0; i < total; i++) {
    const inBand = i >= STAR_COUNT;
    if (inBand) {
      const a = Math.random() * Math.PI * 2;
      const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 0.16;
      v.copy(bandU).multiplyScalar(Math.cos(a)).addScaledVector(bandV, Math.sin(a)).addScaledVector(bandNormal, spread).normalize();
    } else {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    }
    v.multiplyScalar(R);
    pos.set([v.x, v.y, v.z], i * 3);
    const t = Math.random();
    // Mostly blue-white, some warm stars.
    if (t < 0.12) c.setHSL(0.08, 0.7, 0.75);
    else if (t < 0.3) c.setHSL(0.58, 0.6, 0.82);
    else c.setHSL(0.6, 0.15, 0.92);
    const bright = inBand ? 0.35 + Math.random() * 0.35 : 0.5 + Math.random() * 0.5;
    col.set([c.r * bright, c.g * bright, c.b * bright], i * 3);
    const big = Math.random() < 0.02;
    size[i] = inBand ? 0.6 + Math.random() * 0.9 : big ? 2.6 + Math.random() * 1.8 : 0.8 + Math.random() * 1.4;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("size", new THREE.BufferAttribute(size, 1));
  g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  return g;
}

const starMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute float phase; attribute vec3 color;
      uniform float uTime; uniform float uPixel;
      varying vec3 vColor; varying float vTw;
      void main() {
        vColor = color;
        vTw = 0.75 + 0.25 * sin(uTime * (0.6 + fract(phase) * 1.6) + phase * 7.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPixel * 1.25;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vTw;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        gl_FragColor = vec4(vColor * vTw * 1.4, a);
      }`,
  });

const skyMaterial = () =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform vec3 uSun;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        vec3 bandN = normalize(vec3(0.35, 1.0, -0.25));
        float band = exp(-pow(dot(d, bandN) / 0.2, 2.0));
        float n = fbm(d * 3.0);
        float n2 = fbm(d * 7.0 + 4.0);
        vec3 base = vec3(0.004, 0.007, 0.016);
        vec3 neb1 = vec3(0.05, 0.03, 0.09) * smoothstep(0.45, 0.85, n) ;
        vec3 neb2 = vec3(0.01, 0.045, 0.07) * smoothstep(0.5, 0.9, n2);
        vec3 milky = vec3(0.05, 0.05, 0.07) * band * (0.4 + 0.8 * n2);
        float sunGlow = pow(max(dot(d, uSun), 0.0), 24.0) * 0.25;
        vec3 col = base + (neb1 + neb2) * 0.8 + milky + vec3(1.0, 0.8, 0.55) * sunGlow;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

export function Starfield() {
  const geo = useMemo(makeStars, []);
  const mat = useMemo(starMaterial, []);
  const sky = useMemo(skyMaterial, []);
  const sun = useMemo(() => SUN_DIR.clone().multiplyScalar(420), []);
  const sunRef = useRef<THREE.Sprite>(null);

  useFrame(({ clock, gl }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uPixel.value = gl.getPixelRatio();
    if (sunRef.current) {
      const s = 70 + Math.sin(clock.elapsedTime * 0.7) * 2;
      sunRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group>
      <mesh material={sky} renderOrder={-10}>
        <sphereGeometry args={[900, 48, 24]} />
      </mesh>
      <points geometry={geo} material={mat} renderOrder={-9} frustumCulled={false} />
      <sprite position={sun} ref={sunRef}>
        <spriteMaterial map={glowTexture()} color={[6, 5, 3.6]} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} transparent />
      </sprite>
      <sprite position={sun} scale={[16, 16, 1]}>
        <spriteMaterial map={glowTexture()} color={[30, 28, 24]} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} transparent />
      </sprite>
    </group>
  );
}
