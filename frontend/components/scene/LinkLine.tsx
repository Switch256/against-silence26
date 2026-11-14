"use client";
// The space link, in the language of the Blender film: a glowing beam from the habitat to the
// serving DSN antenna, with dashes flowing Earthward.
//   up     = blue beam, dashes flowing
//   window = amber beam (a short contact; only what fits the byte budget crosses)
//   down   = the beam flickers out (loss of signal), then nothing but a plain textual state
// The beam colours are HDR (above 1) so the bloom pass gives them their glow.
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Line2, LineMaterial } from "three-stdlib";
import { COLORS } from "@/lib/constants";
import { anchors } from "@/lib/sceneLayout";
import type { LinkVisual } from "@/lib/store";

/** The link ends at the dish, a little above the ground point. */
export function linkEarthEnd(out: THREE.Vector3) {
  return out.copy(anchors.station).addScaledVector(anchors.stationNormal, 0.14);
}

const FLICKER_S = 0.9;

export function LinkLine({ link, windowLeftS }: { link: LinkVisual; windowLeftS: number | null }) {
  const core = useRef<Line2>(null);
  const dash = useRef<Line2>(null);
  const label = useRef<THREE.Group>(null);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const initial = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], []);
  // when the link last changed state, to play the drop / re-acquire flicker
  const changed = useRef({ state: link, at: -10 });
  const clockNow = useRef(0);
  useEffect(() => {
    if (changed.current.state !== link) changed.current = { state: link, at: clockNow.current };
  }, [link]);

  const hex = link === "window" ? COLORS.caution : COLORS.accent;
  const coreColor = useMemo(() => new THREE.Color(hex).multiplyScalar(1.6), [hex]);
  const dashColor = useMemo(() => new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), 0.35).multiplyScalar(3.2), [hex]);

  useFrame(({ clock }) => {
    const s = (clockNow.current = clock.elapsedTime);
    a.copy(anchors.craft);
    linkEarthEnd(b);
    const pos = [a.x, a.y, a.z, b.x, b.y, b.z];
    core.current?.geometry.setPositions(pos);
    dash.current?.geometry.setPositions(pos);
    core.current?.computeLineDistances();
    dash.current?.computeLineDistances();
    label.current?.position.lerpVectors(b, a, 0.42);

    // flicker for a moment after a change, then settle (down = off, otherwise on)
    const since = s - changed.current.at;
    const on = link !== "down";
    let level = on ? 1 : 0;
    if (since < FLICKER_S) {
      const noise = Math.sin(s * 91) * Math.sin(s * 37) > (on ? -0.2 : 0.25);
      level = noise ? (on ? 1 : 1 - since / FLICKER_S) : 0.05;
    }
    const breathe = 0.85 + 0.15 * Math.sin(s * 2.2);
    for (const [ref, base] of [[core, 0.75], [dash, 1]] as const) {
      const l = ref.current;
      if (!l) continue;
      const m = l.material as LineMaterial;
      l.visible = level > 0.01;
      m.opacity = base * level * breathe;
    }
    // dashes flow from the habitat towards Earth
    const dm = dash.current?.material as LineMaterial | undefined;
    if (dm) dm.dashOffset = -s * 0.9;
  });

  return (
    <group>
      <Line ref={core} points={initial} color={coreColor} lineWidth={1.4} transparent toneMapped={false} frustumCulled={false} />
      <Line
        ref={dash}
        points={initial}
        color={dashColor}
        lineWidth={2.2}
        dashed
        dashSize={0.18}
        gapSize={0.55}
        transparent
        toneMapped={false}
        frustumCulled={false}
      />
      <group ref={label}>
        {link !== "up" && (
          <Html zIndexRange={[30, 0]} style={{ pointerEvents: "none", transform: "translate(-50%, 14px)" }}>
            {link === "down" ? (
              <div className="scene-callout">
                <strong style={{ color: COLORS.warning }}>No link · loss of signal</strong>
                <span>Bundles are held on board until the next contact</span>
              </div>
            ) : (
              <div className="scene-callout">
                <strong style={{ color: COLORS.caution }}>Short contact window{windowLeftS != null ? ` · ${Math.max(0, Math.ceil(windowLeftS))} s left` : ""}</strong>
                <span>Highest-priority layers first, within the byte budget</span>
              </div>
            )}
          </Html>
        )}
      </group>
    </group>
  );
}
