// World layout for the 3D scene. Distances are NOT to scale (labelled in the HUD).
import * as THREE from "three";

export const EARTH_R = 2.6;
export const EARTH_TILT = THREE.MathUtils.degToRad(23.4);
export const MARS_R = 1.3;
export const MARS_POS = new THREE.Vector3(-4, 12, -56);
export const CRAFT_POS = new THREE.Vector3(13.2, 2.6, -3);
export const CRAFT_SCALE = 0.6;

/** Direction the sunlight comes FROM (world space). */
export const SUN_DIR = new THREE.Vector3(-0.62, 0.3, 0.72).normalize();

/** Earth -> spacecraft -> Mars transfer arc. The spacecraft sits exactly on it. */
export const TRAJECTORY = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(2.2, -0.9, 2.0),
    new THREE.Vector3(7.2, 0.4, 2.4),
    CRAFT_POS.clone(),
    new THREE.Vector3(14.2, 5.4, -16),
    new THREE.Vector3(11.5, 9.0, -38),
    new THREE.Vector3(-1.2, 11.6, -53.6),
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

/** Live anchor points, written every frame by Earth/Spacecraft, read by the beam and packets. */
export const anchors = {
  dish: new THREE.Vector3().copy(CRAFT_POS),
  station: new THREE.Vector3(EARTH_R, 0, 0),
  stationNormal: new THREE.Vector3(1, 0, 0),
  outboxOrigin: new THREE.Vector3().copy(CRAFT_POS),
};

/** Lat/lon (degrees) to a point on a sphere, matching three.js SphereGeometry UVs. */
export function latLonToVec3(lat: number, lon: number, r: number, out = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

export const CAMERA_VIEWS = {
  overview: { pos: new THREE.Vector3(11.4, 9.4, 31.2), target: new THREE.Vector3(6.6, 2.8, -3.2) },
  spacecraft: {
    pos: CRAFT_POS.clone().add(new THREE.Vector3(6.4, 2.3, 3.4)),
    target: CRAFT_POS.clone().add(new THREE.Vector3(-4.2, -0.5, -0.3)),
  },
  earth: { pos: new THREE.Vector3(8.6, 4.8, 8.2), target: new THREE.Vector3(1.6, 0.7, -0.6) },
} as const;
