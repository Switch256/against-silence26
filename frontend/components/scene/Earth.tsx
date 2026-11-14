"use client";
// Earth with a physically plausible day/night shader (city lights, ocean glint, clouds, a thin
// atmosphere) and the three Deep Space Network complexes. The serving complex carries the NASA
// DSN 34 m antenna model, pointed at the spacecraft. The globe turns so that complex faces it.
import { Html, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { DSN_STATIONS, type StationId } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { anchors, EARTH_R, EARTH_TILT, latLonToVec3, SUN_DIR } from "@/lib/sceneLayout";
import { DsnAntenna } from "./DsnAntenna";
import { NASA_TEXTURE } from "./models";

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
    vec3 lit = dayCol * (0.015 + 1.05 * max(ndl, 0.0)) * (1.0 - cloud * 0.3);
    // ocean glint
    vec3 h = normalize(uSun + v);
    float glint = pow(max(dot(n, h), 0.0), 160.0) * spec * 0.12 * smoothstep(0.0, 0.2, ndl);
    lit += vec3(1.0, 0.92, 0.8) * glint;
    // city lights on the night side
    vec3 cities = pow(nightCol, vec3(1.8)) * vec3(1.0, 0.82, 0.6) * 1.1 * (1.0 - day);
    vec3 col = mix(cities + dayCol * 0.004, lit, day);
    // atmospheric rim scattering
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float twilight = smoothstep(-0.3, 0.6, ndl);
    col += vec3(0.3, 0.55, 1.0) * fres * twilight * 0.28;
    // warm terminator band

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
    float rim = pow(clamp(1.0 + dot(v, n) * 1.0, 0.0, 1.0), 3.0);
    float rimFade = smoothstep(0.0, 0.35, -dot(v, n) + 0.35);
    float sun = smoothstep(-0.45, 0.6, dot(n, uSun));
    vec3 col = mix(vec3(0.05, 0.15, 0.45), vec3(0.35, 0.65, 1.0), sun);
    float a = rim * rimFade * (0.15 + 0.85 * sun);
    gl_FragColor = vec4(col * a * 0.55, a);
  }`;

function stationLocal(id: StationId) {
  const st = DSN_STATIONS.find((s) => s.id === id)!;
  return latLonToVec3(st.lat, st.lon, EARTH_R);
}

interface Props {
  serving: StationId;
}

const tmp = new THREE.Vector3();
const east = new THREE.Vector3();
const north = new THREE.Vector3();
const axis = new THREE.Vector3();
const wp = new THREE.Vector3();
const tiltQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), EARTH_TILT);
const tiltInv = tiltQ.clone().invert();

export function Earth({ serving }: Props) {
  // All NASA imagery: Blue Marble day, Black Marble night, ocean and cloud masks derived from NASA SVS
  const [day, night, spec, clouds] = useTexture([
    NASA_TEXTURE.earthDay,
    NASA_TEXTURE.earthNight,
    NASA_TEXTURE.earthOcean,
    NASA_TEXTURE.earthClouds,
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
    const craftDir = tmp.copy(anchors.craft).normalize().applyQuaternion(tiltInv);
    return Math.atan2(p.z, p.x) - Math.atan2(craftDir.z, craftDir.x);
  };

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // a little west of overhead, so the antenna visibly tilts towards the spacecraft
    const target = facingAngle(serving) - 0.35 + Math.sin(t * 0.01) * 0.08;
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
      // antenna pointing (azimuth from north, elevation) in the local horizon frame
      axis.set(0, 1, 0).applyQuaternion(tiltQ);
      east.crossVectors(axis, anchors.stationNormal).normalize();
      north.crossVectors(anchors.stationNormal, east);
      const d = tmp.subVectors(anchors.craft, anchors.station).normalize();
      anchors.stationEl = Math.asin(THREE.MathUtils.clamp(d.dot(anchors.stationNormal), -1, 1));
      anchors.stationAz = Math.atan2(d.dot(east), d.dot(north));
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
          <StationMarker key={st.id} id={st.id} name={st.name} active={st.id === serving} />
        ))}
      </group>
      <mesh ref={cloudRef} scale={1.006}>
        <sphereGeometry args={[EARTH_R, 96, 48]} />
        <meshLambertMaterial map={clouds} alphaMap={clouds} transparent depthWrite={false} opacity={0.7} />
      </mesh>
      <mesh material={atmoMat} scale={1.035}>
        <sphereGeometry args={[EARTH_R, 96, 48]} />
      </mesh>
    </group>
  );
}

/** Antenna height on the globe (exaggerated: the globe is not to scale). */
const ANTENNA_SIZE = 0.2;

function StationMarker({ id, name, active }: { id: StationId; name: string; active: boolean }) {
  const pos = useMemo(() => stationLocal(id), [id]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize()), [pos]);
  const groupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  // Only the serving complex is labelled, except in the Ground station view.
  const showLabel = useStore((s) => active || s.view === "earth");

  useFrame(({ camera }) => {
    // hide labels on the far side of the globe
    if (groupRef.current && labelRef.current) {
      groupRef.current.getWorldPosition(wp);
      const facing = wp.clone().normalize().dot(camera.position.clone().sub(wp).normalize());
      labelRef.current.style.opacity = facing > 0.3 ? "1" : "0";
    }
  });

  return (
    <group ref={groupRef} position={pos} quaternion={quat}>
      {active ? (
        <Suspense fallback={null}>
          <ServingAntenna />
        </Suspense>
      ) : (
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.028, 20]} />
          <meshBasicMaterial color="#b4b9bc" toneMapped={false} />
        </mesh>
      )}
      {showLabel && <Html position={[0, active ? ANTENNA_SIZE + 0.12 : 0.1, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div ref={labelRef} className={active ? "scene-label" : "scene-label scene-label--plain"}>
          {active ? <><b>DSN {name}</b> serving</> : <>DSN {name}</>}
        </div>
      </Html>}
    </group>
  );
}

/** The NASA 34 m antenna model, slewed to the spacecraft's azimuth / elevation every frame. */
function ServingAntenna() {
  const ref = useRef<THREE.Group>(null);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const d = useMemo(() => new THREE.Vector3(), []);
  // Direction to the spacecraft in the antenna's own frame (+Y up, model forward +Z).
  const pointing = () => {
    const g = ref.current;
    if (!g) return { az: 0, el: 0.8 };
    g.getWorldQuaternion(q).invert();
    d.subVectors(anchors.craft, anchors.station).normalize().applyQuaternion(q);
    return { az: Math.atan2(d.x, d.z), el: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) };
  };
  return (
    <group ref={ref}>
      <DsnAntenna pointing={pointing} size={ANTENNA_SIZE} />
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
