"use client";
// Mars (procedural surface) and the dashed transfer arc from Earth to Mars.
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CRAFT_T, MARS_POS, MARS_R, SUN_DIR, TRAJECTORY } from "@/lib/sceneLayout";

const marsFragment = /* glsl */ `
  uniform vec3 uSun; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
  void main() {
    vec3 o = normalize(vObj);
    float n = fbm(o * 3.2);
    float m = fbm(o * 9.0 + 3.0);
    vec3 rust = vec3(0.72, 0.32, 0.16);
    vec3 dark = vec3(0.32, 0.14, 0.08);
    vec3 col = mix(dark, rust, smoothstep(0.35, 0.65, n));
    col = mix(col, vec3(0.85, 0.55, 0.38), smoothstep(0.62, 0.8, m) * 0.5);
    float cap = smoothstep(0.86, 0.93, abs(o.y) + n * 0.05);
    col = mix(col, vec3(0.95, 0.93, 0.9), cap);
    vec3 nn = normalize(vN);
    float d = max(dot(nn, uSun), 0.0);
    vec3 v = normalize(cameraPosition - vP);
    float rim = pow(1.0 - max(dot(nn, v), 0.0), 3.0);
    vec3 c = col * (0.03 + 1.2 * d) + vec3(1.0, 0.5, 0.3) * rim * 0.35 * smoothstep(-0.2, 0.5, dot(nn, uSun));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function Mars() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSun: { value: SUN_DIR } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vP; varying vec3 vObj;
          void main() { vObj = position; vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
            vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: marsFragment,
      }),
    [],
  );
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });
  return (
    <group position={MARS_POS}>
      <mesh ref={ref} material={mat} rotation={[0.2, 0, 0.44]}>
        <sphereGeometry args={[MARS_R, 64, 32]} />
      </mesh>
      <Html position={[0, -MARS_R - 0.7, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="scene-label scene-label--mars">MARS</div>
      </Html>
    </group>
  );
}

export function Trajectory() {
  const { flown, ahead } = useMemo(() => {
    const pts = TRAJECTORY.getPoints(240);
    const split = Math.round(CRAFT_T * 240);
    return { flown: pts.slice(0, split + 1), ahead: pts.slice(split) };
  }, []);
  // drei's <Line> is a Line2 mesh whose LineMaterial exposes dashOffset
  const dashRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const mat = dashRef.current?.material as unknown as { dashOffset: number } | undefined;
    if (mat) mat.dashOffset -= dt * 0.6;
  });
  return (
    <group>
      <Line points={flown} color="#5fb8ff" lineWidth={1.2} transparent opacity={0.35} />
      <Line
        ref={dashRef as never}
        points={ahead}
        color="#9fd4ff"
        lineWidth={1.4}
        dashed
        dashSize={0.5}
        gapSize={0.45}
        transparent
        opacity={0.6}
      />
    </group>
  );
}
