"use client";
// The space link: a beam from the spacecraft's high-gain antenna to the serving DSN station.
// up = steady cyan beam with flowing particles; down = broken, flickering red stubs;
// window = bright amber flash while a short contact lasts.
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "@/lib/constants";
import { anchors } from "@/lib/sceneLayout";
import type { LinkVisual } from "@/lib/store";

const beamVertex = /* glsl */ `
  varying vec2 vUv; varying vec3 vNormalV; varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;

const beamFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uTime; uniform float uBroken; uniform float uIntensity;
  uniform float uLen; uniform float uGlow; uniform float uFlow;
  varying vec2 vUv; varying vec3 vNormalV; varying vec3 vViewPos;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float y = vUv.y;
    float facing = abs(dot(normalize(vNormalV), normalize(-vViewPos)));
    float radial = uGlow > 0.5 ? pow(facing, 2.5) : 1.0;
    // pulses flowing from the spacecraft (y=0) to Earth (y=1)
    float bands = 0.65 + 0.35 * smoothstep(0.6, 1.0, sin((y * uLen * 1.6 - uTime * 6.0 * uFlow)));
    // broken link: stubs at both ends + flickering fragments
    float seg = floor(y * uLen * 3.0);
    float flick = step(0.82, hash(seg * 13.1 + floor(uTime * 14.0)));
    float stub = 1.0 - smoothstep(0.03, 0.16, min(y, 1.0 - y));
    float broken = max(stub * (0.55 + 0.45 * step(0.5, hash(floor(uTime * 20.0)))), flick * 0.5);
    float vis = mix(1.0, broken, uBroken);
    float ends = smoothstep(0.0, 0.015, y) * smoothstep(1.0, 0.985, y);
    float a = radial * bands * vis * ends * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }`;

const particleVertex = /* glsl */ `
  attribute float aOffset; attribute float aSize;
  uniform vec3 uA; uniform vec3 uB; uniform float uTime; uniform float uPixel; uniform float uSpeed;
  varying float vFade;
  void main() {
    float t = fract(aOffset + uTime * uSpeed);
    vec3 p = mix(uA, uB, t);
    vFade = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.94, t);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel * (60.0 / -mv.z);
  }`;
const particleFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha; varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * vFade * uAlpha;
    gl_FragColor = vec4(uColor * a * 1.6, a);
  }`;

const Y = new THREE.Vector3(0, 1, 0);
const N_PARTICLES = 90;

export function LinkBeam({ link }: { link: LinkVisual }) {
  const core = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const labelAnchor = useRef<THREE.Group>(null);

  const mkMat = (glowLayer: boolean) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(COLORS.link) },
        uTime: { value: 0 },
        uBroken: { value: 0 },
        uIntensity: { value: 1 },
        uLen: { value: 10 },
        uGlow: { value: glowLayer ? 1 : 0 },
        uFlow: { value: 1 },
      },
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  const coreMat = useMemo(() => mkMat(false), []);
  const glowMat = useMemo(() => mkMat(true), []);

  const particles = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const off = new Float32Array(N_PARTICLES);
    const size = new Float32Array(N_PARTICLES);
    for (let i = 0; i < N_PARTICLES; i++) {
      off[i] = Math.random();
      size[i] = 0.6 + Math.random() * 1.6;
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N_PARTICLES * 3), 3));
    g.setAttribute("aOffset", new THREE.BufferAttribute(off, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uTime: { value: 0 },
        uPixel: { value: 1 }, uSpeed: { value: 0.12 }, uColor: { value: new THREE.Color(COLORS.link) }, uAlpha: { value: 1 },
      },
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { g, m };
  }, []);

  const state = useRef({ broken: 0, intensity: 1, color: new THREE.Color(COLORS.link) });
  const target = useMemo(() => new THREE.Color(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, gl }, dt) => {
    const t = clock.elapsedTime;
    const s = state.current;
    const k = Math.min(1, dt * 4);
    const wantBroken = link === "down" ? 1 : 0;
    s.broken += (wantBroken - s.broken) * k;
    target.set(link === "up" ? COLORS.link : link === "window" ? COLORS.window : COLORS.linkDown);
    s.color.lerp(target, k);
    const strobe = link === "window" ? 1.15 + Math.sin(t * 18) * 0.35 : 1;
    s.intensity += ((link === "down" ? 0.9 : 1.0) * strobe - s.intensity) * k * 2;

    dir.subVectors(anchors.station, anchors.dish);
    const len = dir.length();
    mid.addVectors(anchors.station, anchors.dish).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize());
    for (const [mesh, r] of [[core.current, 0.018], [glow.current, 0.16]] as const) {
      if (!mesh) continue;
      mesh.position.copy(mid);
      mesh.quaternion.copy(q);
      mesh.scale.set(r, len, r);
    }
    for (const m of [coreMat, glowMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uBroken.value = s.broken;
      m.uniforms.uLen.value = len;
      (m.uniforms.uColor.value as THREE.Color).copy(s.color);
    }
    coreMat.uniforms.uIntensity.value = s.intensity * 2.6;
    glowMat.uniforms.uIntensity.value = s.intensity * 0.55;

    const pm = particles.m;
    pm.uniforms.uTime.value = t;
    pm.uniforms.uPixel.value = gl.getPixelRatio();
    (pm.uniforms.uA.value as THREE.Vector3).copy(anchors.dish);
    (pm.uniforms.uB.value as THREE.Vector3).copy(anchors.station);
    (pm.uniforms.uColor.value as THREE.Color).copy(s.color);
    pm.uniforms.uAlpha.value = 1 - s.broken;
    pm.uniforms.uSpeed.value = link === "window" ? 0.3 : 0.12;

    if (labelAnchor.current) labelAnchor.current.position.copy(mid);
  });

  return (
    <group>
      <mesh ref={glow} material={glowMat} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 16, 1, true]} />
      </mesh>
      <mesh ref={core} material={coreMat} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
      </mesh>
      <points geometry={particles.g} material={particles.m} frustumCulled={false} />
      <group ref={labelAnchor}>
        {link !== "up" && (
          <Html center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
            <div className={`beam-flag beam-flag--${link}`}>
              <span className="beam-flag__dot" />
              {link === "down" ? "LINK LOST · BLACKOUT" : "SHORT CONTACT WINDOW"}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
