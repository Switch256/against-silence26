// World layout for the 3D view. Distances and sizes are NOT to scale (stated in the viewport).
import * as THREE from "three";

export const EARTH_R = 2.6;
export const EARTH_TILT = THREE.MathUtils.degToRad(23.4);
export const MARS_R = 1.0;
export const MARS_POS = new THREE.Vector3(-6, 10, -70);
export const CRAFT_POS = new THREE.Vector3(12.5, 2.4, -3);
/** Largest dimension of the habitat model, scene units. */
export const CRAFT_SIZE = 3.0;

/** Direction the sunlight comes FROM (world space). */
export const SUN_DIR = new THREE.Vector3(-0.42, 0.28, 0.86).normalize();

/** Earth -> spacecraft -> Mars transfer arc (drawn as a thin reference line). */
export const TRAJECTORY = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(2.2, -0.9, 2.0),
    new THREE.Vector3(7.2, 0.4, 2.0),
    CRAFT_POS.clone(),
    new THREE.Vector3(14.2, 5.0, -18),
    new THREE.Vector3(9.5, 8.6, -44),
    new THREE.Vector3(-3.4, 9.8, -67.6),
  ],
  false,
  "centripetal",
);

/** Parameter of the spacecraft along TRAJECTORY (found once by nearest sample). */
export const CRAFT_T = (() => {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 2000; i++) {
    const t = i / 2000;
    const d = TRAJECTORY.getPoint(t).distanceToSquared(CRAFT_POS);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
})();

/**
 * The habitat travels along the arc with mission time, always moving: it covers CRAFT_SPAN of the
 * curve every CRAFT_TRAVEL_S, then loops (the eased follow in Spacecraft glides it back to the start).
 * /api/reset restarts it.
 */
export const CRAFT_SPAN = 0.24;
export const CRAFT_TRAVEL_S = 30 * 60;
const CRAFT_START = Math.min(Math.max(CRAFT_T - CRAFT_SPAN * 0.35, 0.02), 0.98 - CRAFT_SPAN);
export function craftT(missionS: number) {
  const k = (Math.max(0, missionS) % CRAFT_TRAVEL_S) / CRAFT_TRAVEL_S;
  return CRAFT_START + CRAFT_SPAN * k;
}

/** Live anchor points, written every frame by Earth / the spacecraft, read by the link and packets. */
export const anchors = {
  /** where the link leaves the spacecraft (moves with the habitat) */
  craft: new THREE.Vector3().copy(CRAFT_POS),
  /** current parameter of the habitat along TRAJECTORY */
  craftT: CRAFT_T,
  /** serving DSN antenna, world space */
  station: new THREE.Vector3(EARTH_R, 0, 0),
  stationNormal: new THREE.Vector3(1, 0, 0),
  /** pointing of the serving antenna in its local horizon frame (radians) */
  stationAz: 0,
  stationEl: Math.PI / 3,
};

/** Lat/lon (degrees) to a point on a sphere, matching three.js SphereGeometry UVs. */
export function latLonToVec3(lat: number, lon: number, r: number, out = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** Camera presets. "spacecraft" is relative to the moving habitat, "earth" to the serving antenna. */
export const CAMERA_VIEWS = {
  overview: { pos: new THREE.Vector3(8.0, 6.0, 21.0), target: new THREE.Vector3(6.2, 1.4, -2.0) },
  /** offsets from anchors.craft */
  spacecraft: { pos: new THREE.Vector3(6.0, 2.5, 4.8), target: new THREE.Vector3(0.0, -0.3, -0.2) },
} as const;
