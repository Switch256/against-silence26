"use client";
// Live crew body (simulated physiology on the NASA astronaut model, NASA 3D Resources).
// Everything moves from live telemetry held in a ref, so React never re-renders the Canvas:
//   heart glow beating lub-dub at the live heart rate, a pulse wave running over the suit on each beat,
//   chest breathing (vertex displacement) at an estimated rate, a rim tone that turns bluish with low
//   SpO2 and amber/red with an alert, a wrist sensor that blinks on each reading and flickers when the
//   watch is loose, a slow turntable sweep, microgravity drift and a sway during exercise.
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { MODEL, useNormalizedModel } from "@/components/scene/models";

export interface BodyLive {
  hr: number | null;
  /** breaths per minute (estimated, simulated) */
  breath: number;
  activity: string;
  /** 0 = normal, 1 = clearly low oxygen */
  hypoxia: number;
  /** heart colour */
  heart: "nominal" | "caution" | "warning";
  /** rim alert tone */
  alert: "none" | "caution" | "warning";
  poorSignal: boolean;
  /** changes on every new reading (wrist sensor blink) */
  readingKey: string;
  reducedMotion: boolean;
}

const HEART_COLOR = { nominal: "#ff7d8c", caution: "#f0b429", warning: "#ff5a4a" } as const;
const HEART_C = { nominal: new THREE.Color(HEART_COLOR.nominal), caution: new THREE.Color(HEART_COLOR.caution), warning: new THREE.Color(HEART_COLOR.warning) };
const WHITE = new THREE.Color("#ffffff");
const tmpRim = new THREE.Color();
const RIM = {
  neutral: new THREE.Color("#7f97b4"),
  hypoxic: new THREE.Color("#4d78ff"),
  caution: new THREE.Color("#f0b429"),
  warning: new THREE.Color("#ff6b5b"),
};
const CYANOTIC = new THREE.Color("#6f8cf0");
const SENSOR_OK = new THREE.Color("#3fbf7f");
const SENSOR_POOR = new THREE.Color("#f0b429");

const SIZE = 1.9;
const g = (x: number, mu: number, s: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
/** lub-dub envelope over one beat, phase 0..1 -> 0..1 */
const lubDub = (p: number) => Math.min(1, g(p, 0.07, 0.04) + 0.62 * g(p, 0.3, 0.05));

// ---------------------------------------------------------------------------
// Shared GLSL: body-space position and chest weight (breathing displacement)
// ---------------------------------------------------------------------------
const BODY_VERT = /* glsl */ `
uniform mat4 uBodyInv;
uniform float uBreath;
uniform vec3 uChest;
uniform vec3 uChestSize;
vec3 bodySpace(vec3 p) { return (uBodyInv * modelMatrix * vec4(p, 1.0)).xyz; }
float chestWeight(vec3 bp) {
  vec3 d = (bp - uChest) / uChestSize;
  return exp(-dot(d.xy, d.xy)) * smoothstep(-0.6, 0.4, d.z);
}
`;

const OVERLAY_VERT = /* glsl */ `
${BODY_VERT}
varying vec3 vN;
varying vec3 vV;
varying vec3 vBP;
void main() {
  vec3 p = position + normal * uBreath * chestWeight(bodySpace(position));
  vBP = bodySpace(p);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const OVERLAY_FRAG = /* glsl */ `
uniform vec3 uRim;
uniform float uRimI;
uniform vec3 uHeart;
uniform vec3 uHeartCol;
uniform float uBeat;
uniform float uWave;
uniform float uWaveAmp;
uniform float uScan;
uniform float uFlicker;
uniform float uTime;
uniform float uHypoxia;
varying vec3 vN;
varying vec3 vV;
varying vec3 vBP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float facing = max(dot(normalize(vN), normalize(vV)), 0.0);
  float fres = pow(1.0 - facing, 2.4);
  vec3 col = uRim * fres * uRimI;
  // low oxygen: a cool bluish wash over the whole body, strongest at the silhouette
  col += vec3(0.20, 0.34, 1.0) * uHypoxia * (0.07 + 0.35 * fres);
  // light from the heart through the suit fabric
  float d = distance(vBP, uHeart);
  col += uHeartCol * exp(-d * d / 0.005) * (0.06 + 0.4 * uBeat) * (0.35 + 0.65 * facing);
  // pulse wave travelling outward from the heart on each beat
  float w = exp(-pow((d - uWave) / 0.045, 2.0)) * uWaveAmp;
  col += uHeartCol * w * (0.10 + 0.30 * fres);
  // slow sensor sweep up the body
  float s = exp(-pow((vBP.y - uScan) / 0.018, 2.0));
  col += uRim * s * 0.10 * (0.4 + fres);
  // loose sensor: grainy, unsteady overlay
  float grain = mix(1.0, 0.55 + 0.9 * hash(floor(vBP.xy * 90.0) + floor(uTime * 24.0)), step(uFlicker, 0.999));
  col *= uFlicker * grain;
  gl_FragColor = vec4(col, 1.0);
}
`;

type Uniforms = Record<string, THREE.IUniform>;

function makeUniforms(): Uniforms {
  return {
    uBodyInv: { value: new THREE.Matrix4() },
    uBreath: { value: 0 },
    uChest: { value: new THREE.Vector3() },
    uChestSize: { value: new THREE.Vector3(0.2, 0.16, 0.1) },
    uRim: { value: RIM.neutral.clone() },
    uRimI: { value: 0.7 },
    uHeart: { value: new THREE.Vector3() },
    uHeartCol: { value: new THREE.Color(HEART_COLOR.nominal) },
    uBeat: { value: 0 },
    uWave: { value: 0 },
    uWaveAmp: { value: 0 },
    uScan: { value: 0 },
    uFlicker: { value: 1 },
    uTime: { value: 0 },
    uHypoxia: { value: 0 },
  };
}

/** Find the chest (front surface) and the left wrist from the vertices, in body (wrapper) space. */
function analyze(wrapper: THREE.Object3D) {
  wrapper.updateMatrixWorld(true);
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  wrapper.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position");
    const step = Math.max(1, Math.floor(pos.count / 12000));
    for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
  });
  const box = new THREE.Box3().setFromPoints(pts);
  const h = box.max.y - box.min.y;
  const chestY = box.min.y + h * 0.69;
  let front = -Infinity;
  for (const p of pts) if (Math.abs(p.x) < h * 0.06 && Math.abs(p.y - chestY) < h * 0.04) front = Math.max(front, p.z);
  if (!Number.isFinite(front)) front = box.max.z * 0.6;
  // left wrist: astronaut's left = +x when facing the camera; a band a little in from the fingertips
  const maxX = box.max.x;
  const wristX = maxX - h * 0.1;
  const wrist = new THREE.Vector3();
  let n = 0;
  for (const p of pts) if (Math.abs(p.x - wristX) < h * 0.015) { wrist.add(p); n++; }
  if (n) wrist.divideScalar(n); else wrist.set(wristX, chestY - h * 0.2, 0);
  let wristFront = wrist.z;
  for (const p of pts) if (Math.abs(p.x - wristX) < h * 0.015) wristFront = Math.max(wristFront, p.z);
  return {
    h,
    minY: box.min.y,
    chest: new THREE.Vector3(h * 0.025, chestY, front),
    wrist: new THREE.Vector3(wrist.x, wrist.y, wristFront + h * 0.01),
  };
}

function glowTexture(ring = false) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (ring) {
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.72, "rgba(255,255,255,0)");
    grd.addColorStop(0.86, "rgba(255,255,255,0.9)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.18, "rgba(255,255,255,0.65)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.16)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
  }
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Body({ live }: { live: MutableRefObject<BodyLive> }) {
  const { object } = useNormalizedModel(MODEL.astronaut, SIZE);
  const figure = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Sprite>(null);
  const core = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Sprite>(null);
  const sensor = useRef<THREE.Sprite>(null);
  const sensorRing = useRef<THREE.Sprite>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);

  const uniforms = useMemo(makeUniforms, []);
  const baseMats = useRef<{ mat: THREE.MeshStandardMaterial; color: THREE.Color }[]>([]);
  const tex = useMemo(() => ({ glow: glowTexture(), ring: glowTexture(true) }), []);
  const anat = useMemo(() => analyze(object), [object]);
  const heartPos = useMemo(() => anat.chest.clone().add(new THREE.Vector3(0, 0, anat.h * 0.025)), [anat]);

  // Base materials: inject the breathing displacement; overlay: a fresnel/heart shader on the same geometry.
  const overlay = useMemo(() => {
    const scale = object.scale.x || 1;
    uniforms.uChest.value.set(anat.chest.x * 0.3, anat.chest.y - anat.h * 0.02, anat.chest.z - anat.h * 0.06);
    uniforms.uChestSize.value.set(anat.h * 0.11, anat.h * 0.09, anat.h * 0.08);
    uniforms.uHeart.value.set(anat.chest.x, anat.chest.y, anat.chest.z - anat.h * 0.03);
    uniforms.uBreathScale = { value: 1 / scale };
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: OVERLAY_VERT, fragmentShader: OVERLAY_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const meshes: THREE.Mesh[] = [];
    baseMats.current = [];
    object.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.aegisOverlay) meshes.push(m); });
    for (const m of meshes) {
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];
      for (const bm of mats) {
        if (bm.color) baseMats.current.push({ mat: bm, color: bm.color.clone() });
        bm.onBeforeCompile = (shader) => {
          for (const k of ["uBodyInv", "uBreath", "uChest", "uChestSize"]) shader.uniforms[k] = uniforms[k];
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>\n${BODY_VERT}`)
            .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += objectNormal * uBreath * chestWeight(bodySpace(transformed));");
        };
        bm.customProgramCacheKey = () => "aegis-breath";
        bm.needsUpdate = true;
      }
      m.children.filter((c) => c.userData.aegisOverlay).forEach((c) => m.remove(c));   // StrictMode re-run
      const o = new THREE.Mesh(m.geometry, mat);
      o.userData.aegisOverlay = true;
      o.renderOrder = 2;
      m.add(o);
    }
    return mat;
  }, [object, anat, uniforms]);

  useEffect(() => () => { overlay.dispose(); tex.glow.dispose(); tex.ring.dispose(); }, [overlay, tex]);

  const s = useRef({
    phase: 0, breathPhase: 0, beatAge: 9, rim: RIM.neutral.clone(), rimI: 0.55,
    heartCol: new THREE.Color(HEART_COLOR.nominal), sensorCol: SENSOR_OK.clone(), lastKey: "", sensorAge: 9,
    flick: 1, exercise: 0, poor: 0, hr: 70, breath: 14, hyp: 0,
  });

  useFrame((state, rawDt) => {
    const L = live.current;
    const st = s.current;
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;
    const ease = (k: number) => 1 - Math.exp(-dt * k);

    st.hr += ((L.hr ?? 0) - st.hr) * ease(3);
    st.breath += (L.breath - st.breath) * ease(1.5);
    st.exercise += ((L.activity === "exercise" ? 1 : 0) - st.exercise) * ease(1.2);
    st.poor += ((L.poorSignal ? 1 : 0) - st.poor) * ease(2.5);

    // heart: lub-dub at the live rate
    const prev = st.phase;
    if (L.hr) st.phase = (st.phase + (st.hr / 60) * dt) % 1;
    if (st.phase < prev) st.beatAge = 0;
    st.beatAge += dt;
    const beat = L.hr ? lubDub(st.phase) : 0;
    const warn = L.heart === "warning" ? 1 : 0;

    // breathing: smooth inhale/exhale, deeper in exercise
    st.breathPhase = (st.breathPhase + (st.breath / 60) * dt) % 1;
    const breath = 0.5 - 0.5 * Math.cos(st.breathPhase * Math.PI * 2);
    const depth = 1 + st.exercise * 0.6;

    // loose sensor flicker
    if (st.poor > 0.05) {
      const drop = Math.random() < 0.06 ? 0.45 : 0;
      st.flick = 1 - st.poor * (0.18 + 0.12 * Math.sin(t * 31) * Math.sin(t * 7.7) + drop);
    } else st.flick = 1;

    // colours ease towards their targets; low oxygen tints the body itself, the rim carries the alert
    st.hyp += (L.hypoxia - st.hyp) * ease(1.5);
    uniforms.uHypoxia.value = st.hyp;
    for (const b of baseMats.current) b.mat.color.copy(b.color).lerp(CYANOTIC, st.hyp * 0.7);
    const targetRim = L.alert === "warning" ? RIM.warning : L.alert === "caution" ? RIM.caution
      : tmpRim.copy(RIM.neutral).lerp(RIM.hypoxic, L.hypoxia);
    st.rim.lerp(targetRim, ease(2));
    const rimTarget = L.alert === "warning" ? 1.25 : L.alert === "caution" ? 0.95 : 0.75 + 0.7 * L.hypoxia;
    st.rimI += (rimTarget - st.rimI) * ease(2);
    st.heartCol.lerp(HEART_C[L.heart], ease(3));

    // figure motion
    const fig = figure.current;
    if (fig) {
      const rm = L.reducedMotion;
      fig.rotation.y = rm ? -0.25 : -0.22 + 0.42 * Math.sin((t * Math.PI * 2) / 26);
      const cadence = t * Math.PI * 2 * 0.85;
      fig.rotation.z = rm ? 0 : st.exercise * 0.035 * Math.sin(cadence);
      fig.rotation.x = rm ? 0 : 0.015 * Math.sin(t * 0.37);
      fig.position.y = rm ? 0 : 0.018 * Math.sin(t * 0.45) + st.exercise * 0.012 * Math.abs(Math.sin(cadence));
      fig.position.y += breath * 0.006 * depth;
      const sc = 1 + breath * 0.006 * depth;
      fig.scale.set(sc, 1 + breath * 0.003 * depth, sc);
      fig.updateMatrixWorld(true);
      uniforms.uBodyInv.value.copy(fig.matrixWorld).invert();
    }
    uniforms.uBreath.value = (breath - 0.3) * anat.h * 0.016 * depth * (uniforms.uBreathScale?.value ?? 1);

    // overlay uniforms
    uniforms.uRim.value.copy(st.rim);
    uniforms.uRimI.value = st.rimI * (1 + 0.08 * beat) * (L.alert === "warning" ? 0.85 + 0.15 * Math.sin(t * 3) : 1);
    uniforms.uHeartCol.value.copy(st.heartCol);
    uniforms.uBeat.value = beat * (1 + 0.5 * warn) * (1 - 0.5 * st.poor);
    const waveT = st.beatAge / 0.75;
    uniforms.uWave.value = L.reducedMotion ? 0 : waveT * anat.h * 0.62;
    uniforms.uWaveAmp.value = L.reducedMotion || !L.hr ? 0 : Math.max(0, 1 - waveT) ** 1.5 * (0.9 + 0.6 * warn);
    uniforms.uScan.value = L.reducedMotion ? -9 : anat.minY + ((t / 5.5) % 1.25) * anat.h;
    uniforms.uFlicker.value = st.flick;
    uniforms.uTime.value = t;

    // heart sprites
    const hb = 1 + (0.32 + 0.3 * warn) * beat;
    if (halo.current) {
      halo.current.scale.setScalar(anat.h * 0.26 * (L.reducedMotion ? 1 : hb));
      const m = halo.current.material as THREE.SpriteMaterial;
      m.color.copy(st.heartCol); m.opacity = (0.35 + 0.55 * beat) * st.flick;
    }
    if (core.current) {
      core.current.scale.setScalar(anat.h * 0.07 * (L.reducedMotion ? 1 : 1 + 0.25 * beat));
      const m = core.current.material as THREE.SpriteMaterial;
      m.color.copy(st.heartCol).lerp(WHITE, 0.25 * beat); m.opacity = (0.6 + 0.4 * beat) * st.flick;
    }
    if (ring.current) {
      const a = Math.min(1, st.beatAge / 0.9);
      ring.current.visible = !L.reducedMotion && !!L.hr;
      ring.current.scale.setScalar(anat.h * (0.06 + 0.24 * a));
      const m = ring.current.material as THREE.SpriteMaterial;
      m.color.copy(st.heartCol); m.opacity = (1 - a) ** 2 * (0.35 + 0.3 * warn) * st.flick;
    }

    // wrist sensor: blink on each reading, amber and unsteady when contact is poor
    if (L.readingKey !== st.lastKey) { st.lastKey = L.readingKey; st.sensorAge = 0; }
    st.sensorAge += dt;
    st.sensorCol.lerp(L.poorSignal ? SENSOR_POOR : SENSOR_OK, ease(6));
    const blink = Math.exp(-st.sensorAge * 5);
    if (sensor.current) {
      const m = sensor.current.material as THREE.SpriteMaterial;
      m.color.copy(st.sensorCol);
      const unsteady = st.poor > 0.5 ? (Math.sin(t * 9) > 0 ? 1 : 0.25) : 1;
      m.opacity = (0.45 + 0.55 * blink) * unsteady;
      sensor.current.scale.setScalar(anat.h * (0.05 + 0.025 * blink + 0.02 * st.poor));
    }
    if (sensorRing.current) {
      const a = Math.min(1, st.sensorAge / 0.8);
      sensorRing.current.visible = !L.reducedMotion;
      sensorRing.current.scale.setScalar(anat.h * (0.03 + 0.09 * a));
      const m = sensorRing.current.material as THREE.SpriteMaterial;
      m.color.copy(st.sensorCol); m.opacity = (1 - a) ** 2 * 0.6;
    }

    if (keyLight.current) keyLight.current.intensity = 1.9 * (0.75 + 0.25 * st.flick);
  });

  const spriteMat = (map: THREE.Texture) => (
    <spriteMaterial map={map} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
  );

  return (
    <>
      <directionalLight ref={keyLight} position={[-2, 3, 3]} intensity={1.9} />
      <group ref={figure}>
        <primitive object={object} />
        <sprite ref={halo} position={heartPos} renderOrder={3}>{spriteMat(tex.glow)}</sprite>
        <sprite ref={core} position={heartPos} renderOrder={4}>{spriteMat(tex.glow)}</sprite>
        <sprite ref={ring} position={heartPos} renderOrder={4}>{spriteMat(tex.ring)}</sprite>
        <sprite ref={sensor} position={anat.wrist} renderOrder={4}>{spriteMat(tex.glow)}</sprite>
        <sprite ref={sensorRing} position={anat.wrist} renderOrder={4}>{spriteMat(tex.ring)}</sprite>
      </group>
    </>
  );
}

export function BodyFigure({ live }: { live: MutableRefObject<BodyLive> }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.16, 3.95], fov: 30 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.85 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.22} />
      <directionalLight position={[3, 1, -2]} intensity={0.6} color="#9fb4d0" />
      <directionalLight position={[0, -2, 2]} intensity={0.25} color="#8090a0" />
      <Suspense fallback={null}>
        <Body live={live} />
      </Suspense>
    </Canvas>
  );
}
