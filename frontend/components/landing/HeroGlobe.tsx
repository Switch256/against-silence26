"use client";
// Landing hero: a very large, slowly turning 3D Earth seen from orbit (NASA Blue Marble day side,
// Black Marble city lights on the night side, a drifting cloud layer, a thin atmosphere), with a
// faint link line from a distant spacecraft and a PulseBrief packet crossing it.
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { BASE_PATH } from "@/lib/config";

const SUN = new THREE.Vector3(1.2, 0.9, 0.7).normalize();

const earthVertex = /* glsl */ `
  varying vec2 vUv; varying vec3 vN;
  void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;
const earthFragment = /* glsl */ `
  uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN;
  void main() {
    float d = dot(normalize(vN), uSun);
    float day = smoothstep(-0.12, 0.25, d);
    vec3 dayCol = texture2D(uDay, vUv).rgb * (0.25 + 0.95 * max(d, 0.0));
    vec3 nightCol = texture2D(uNight, vUv).rgb * vec3(1.0, 0.85, 0.6) * 1.4;
    gl_FragColor = vec4(mix(nightCol, dayCol, day), 1.0);
    #include <colorspace_fragment>
  }`;
const atmoVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const atmoFragment = /* glsl */ `
  uniform vec3 uSun; varying vec3 vN; varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(vN, vV)), 3.0);
    float lit = 0.35 + 0.65 * smoothstep(-0.3, 0.6, dot(vN, uSun));
    gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * rim * lit * 1.6, rim * lit);
  }`;

function Earth() {
  const [day, night, clouds] = useTexture([
    `${BASE_PATH}/textures/nasa/earth_day_bluemarble_2048.jpg`,
    `${BASE_PATH}/textures/nasa/earth_black_marble_2012_3600.jpg`,
    `${BASE_PATH}/textures/nasa/earth_clouds_svs3615_2048.png`,
  ]);
  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    [day, night, clouds].forEach((t) => (t.anisotropy = 8));
  }, [day, night, clouds]);
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uDay: { value: day }, uNight: { value: night }, uSun: { value: SUN } }, vertexShader: earthVertex, fragmentShader: earthFragment }), [day, night]);
  const atmo = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN } }, vertexShader: atmoVertex, fragmentShader: atmoFragment, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const earth = useRef<THREE.Mesh>(null);
  const cloud = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (earth.current) earth.current.rotation.y += dt * 0.025;
    if (cloud.current) cloud.current.rotation.y += dt * 0.032;
  });
  return (
    <group rotation={[-0.95, 0, 0.12]}>
      <mesh ref={earth} material={mat}><sphereGeometry args={[1, 128, 128]} /></mesh>
      <mesh ref={cloud} scale={1.008}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshLambertMaterial map={clouds} alphaMap={clouds} transparent depthWrite={false} opacity={0.55} />
      </mesh>
      <mesh material={atmo} scale={1.06}><sphereGeometry args={[1, 96, 96]} /></mesh>
    </group>
  );
}

/** A thin link from a distant spacecraft (top right) down to Earth, with a packet travelling along it. */
function Link() {
  const from = useMemo(() => new THREE.Vector3(2.6, 1.7, -1.2), []);
  const to = useMemo(() => new THREE.Vector3(0.35, 0.93, 0.12), []);
  const line = useMemo(() => new THREE.BufferGeometry().setFromPoints([from, to]), [from, to]);
  const packet = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.18) % 1;
    packet.current?.position.lerpVectors(from, to, t);
    if (packet.current) (packet.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI);
  });
  return (
    <group>
      <primitive object={new THREE.Line(line, new THREE.LineBasicMaterial({ color: "#6ea8ff", transparent: true, opacity: 0.35 }))} />
      <mesh position={from}><sphereGeometry args={[0.012, 12, 12]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh ref={packet}><sphereGeometry args={[0.014, 12, 12]} /><meshBasicMaterial color="#ff6b5e" transparent /></mesh>
    </group>
  );
}

export default function HeroGlobe() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.2, 2.35], fov: 40 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.15} />
      <directionalLight position={SUN.clone().multiplyScalar(5)} intensity={2.2} />
      <Suspense fallback={null}>
        {/* the planet sits low and huge: its horizon rises behind the headline */}
        <group position={[0, -0.86, 0]}>
          <Earth />
        </group>
        <group position={[0, -0.86, 0]}><Link /></group>
      </Suspense>
    </Canvas>
  );
}
