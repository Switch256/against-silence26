"use client";
// Earth with a day/night shader, city lights, ocean glint, clouds, atmosphere and the three
// Deep Space Network complexes. The globe turns so the serving station faces the spacecraft.
import { Html, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS, DSN_STATIONS, type StationId } from "@/lib/constants";
import { anchors, CRAFT_POS, EARTH_R, EARTH_TILT, latLonToVec3, SUN_DIR } from "@/lib/sceneLayout";
import type { LinkVisual } from "@/lib/store";
import { glowTexture, ringTexture } from "./textures";

const earthVertex = /* glsl */ `
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const earthFragment = /* glsl */ `
  uniform sampler2D uDay; uniform sampler2D uNight; uniform sampler2D uSpec; uniform sampler2D uClouds;
  uniform vec3 uSun; uniform float uCloudShift;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    float ndl = dot(n, uSun);
    float day = smoothstep(-0.12, 0.28, ndl);
    vec3 dayCol = texture2D(uDay, vUv).rgb;
    vec3 nightCol = texture2D(uNight, vUv).rgb;
    float spec = texture2D(uSpec, vUv).r;
    // cloud shadow on the ground
    float cloud = texture2D(uClouds, vUv + vec2(uCloudShift, 0.0)).r;
    vec3 lit = dayCol * (0.06 + 1.0 * max(ndl, 0.0)) * (1.0 - cloud * 0.35);
    // ocean glint
    vec3 h = normalize(uSun + v);
    float glint = pow(max(dot(n, h), 0.0), 140.0) * spec * 0.18 * smoothstep(0.0, 0.2, ndl);
    lit += vec3(1.0, 0.92, 0.8) * glint;
    // city lights on the night side
    vec3 cities = pow(nightCol, vec3(1.4)) * vec3(1.0, 0.78, 0.48) * 2.6 * (1.0 - day);
    vec3 col = mix(cities + dayCol * 0.015, lit, day);
    // atmospheric rim scattering
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float twilight = smoothstep(-0.3, 0.6, ndl);
    col += vec3(0.25, 0.55, 1.0) * fres * twilight * 0.9;
    // warm terminator band
    col += vec3(0.9, 0.35, 0.1) * exp(-pow(ndl / 0.06, 2.0)) * 0.03 * (1.0 - fres);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const atmoVertex = /* glsl */ `
  varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz; vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const atmoFragment = /* glsl */ `
  uniform vec3 uSun; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    float rim = pow(clamp(1.0 + dot(v, n) * 1.0, 0.0, 1.0), 2.0);
    float rimFade = smoothstep(0.0, 0.35, -dot(v, n) + 0.35);
    float sun = smoothstep(-0.45, 0.6, dot(n, uSun));
    vec3 col = mix(vec3(0.05, 0.15, 0.45), vec3(0.35, 0.65, 1.0), sun);
    float a = rim * rimFade * (0.15 + 0.85 * sun);
    gl_FragColor = vec4(col * a * 1.6, a);
  }`;

function stationLocal(id: StationId) {
  const st = DSN_STATIONS.find((s) => s.id === id)!;
  return latLonToVec3(st.lat, st.lon, EARTH_R);
}

interface Props {
  serving: StationId;
  link: LinkVisual;
}

const tmp = new THREE.Vector3();
const wp = new THREE.Vector3();
const wn = new THREE.Vector3();
const wv = new THREE.Vector3();
const tiltQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), EARTH_TILT);
const tiltInv = tiltQ.clone().invert();

export function Earth({ serving, link }: Props) {
  const [day, night, spec, clouds] = useTexture([
    "/textures/earth_atmos_2048.jpg",
    "/textures/earth_lights_2048.png",
    "/textures/earth_specular_2048.jpg",
    "/textures/earth_clouds_1024.png",
  ]);
  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    [day, night, spec, clouds].forEach((t) => (t.anisotropy = 8));
    clouds.wrapS = THREE.RepeatWrapping;
  }, [day, night, spec, clouds]);

  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uDay: { value: day }, uNight: { value: night }, uSpec: { value: spec }, uClouds: { value: clouds },
          uSun: { value: SUN_DIR }, uCloudShift: { value: 0 },
        },
        vertexShader: earthVertex,
        fragmentShader: earthFragment,
      }),
    [day, night, spec, clouds],
  );
  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSun: { value: SUN_DIR } },
        vertexShader: atmoVertex,
        fragmentShader: atmoFragment,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const spin = useRef<THREE.Group>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const angle = useRef<number | null>(null);

  // Spin angle that puts a station's meridian towards the spacecraft.
  const facingAngle = (id: StationId) => {
    const p = stationLocal(id);
    const craftDir = tmp.copy(CRAFT_POS).normalize().applyQuaternion(tiltInv);
    return Math.atan2(p.z, p.x) - Math.atan2(craftDir.z, craftDir.x);
  };

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const target = facingAngle(serving) + Math.sin(t * 0.012) * 0.22;
    if (angle.current === null) angle.current = target;
    // ease forward (eastward) to the new station on hand-over
    let diff = target - angle.current;
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    angle.current += diff * Math.min(1, dt * 0.8);
    if (spin.current) {
      spin.current.rotation.y = angle.current;
      // publish the serving station's world position + normal
      const local = stationLocal(serving);
      spin.current.updateWorldMatrix(true, false);
      anchors.station.copy(local).applyMatrix4(spin.current.matrixWorld);
      anchors.stationNormal.copy(anchors.station).normalize();
    }
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.006;
    earthMat.uniforms.uCloudShift.value = -(cloudRef.current?.rotation.y ?? 0) / (Math.PI * 2);
  });

  return (
    <group quaternion={tiltQ}>
      <group ref={spin}>
        <mesh material={earthMat}>
          <sphereGeometry args={[EARTH_R, 128, 64]} />
        </mesh>
        {DSN_STATIONS.map((st) => (
          <StationBeacon key={st.id} id={st.id} name={st.name} active={st.id === serving} link={link} />
        ))}
      </group>
      <mesh ref={cloudRef} scale={1.012}>
        <sphereGeometry args={[EARTH_R, 96, 48]} />
        <meshLambertMaterial map={clouds} alphaMap={clouds} transparent depthWrite={false} opacity={0.85} />
      </mesh>
      <mesh material={atmoMat} scale={1.13}>
        <sphereGeometry args={[EARTH_R, 96, 48]} />
      </mesh>
    </group>
  );
}

function StationBeacon({ id, name, active, link }: { id: StationId; name: string; active: boolean; link: LinkVisual }) {
  const pos = useMemo(() => stationLocal(id), [id]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize()), [pos]);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const groupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const color = !active ? "#9fd8ff" : link === "up" ? COLORS.link : link === "window" ? COLORS.window : COLORS.linkDown;

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    // hide labels on the far side of the globe
    if (groupRef.current && labelRef.current) {
      groupRef.current.getWorldPosition(wp);
      const facing = wn.copy(wp).normalize().dot(wv.copy(camera.position).sub(wp).normalize());
      labelRef.current.style.opacity = facing > -0.12 ? "1" : "0";
    }
    [ringA.current, ringB.current].forEach((r, i) => {
      if (!r) return;
      const p = (t * 0.55 + i * 0.5) % 1;
      const s = active ? 0.08 + p * 0.55 : 0.0001;
      r.scale.set(s, s, s);
      (r.material as THREE.MeshBasicMaterial).opacity = active ? (1 - p) * 0.9 : 0;
    });
    if (glowRef.current) {
      const s = active ? 0.62 + Math.sin(t * 3) * 0.06 : 0.3;
      glowRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group ref={groupRef} position={pos} quaternion={quat}>
      {/* antenna mast */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.012, 0.02, 0.12, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <sprite ref={glowRef} position={[0, 0.03, 0]}>
        <spriteMaterial map={glowTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={active ? 1 : 0.55} />
      </sprite>
      {[ringA, ringB].map((r, i) => (
        <mesh key={i} ref={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={ringTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Html position={[0, 0.2, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div ref={labelRef} className={`scene-label ${active ? "scene-label--active" : "scene-label--dim"}`} data-state={active ? link : "idle"}>
          <span className="scene-label__dot" />
          DSN {name}
        </div>
      </Html>
    </group>
  );
}

/** Shown for the moment the Earth textures are still loading. */
export function EarthPlaceholder() {
  return (
    <mesh>
      <sphereGeometry args={[EARTH_R, 64, 32]} />
      <meshStandardMaterial color="#1b3a66" roughness={0.9} metalness={0} />
    </mesh>
  );
}
