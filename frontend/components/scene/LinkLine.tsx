"use client";
// The space link: one thin, precise line from the habitat to the serving DSN antenna.
//   up     = accent line
//   window = amber line (a short contact; only what fits the byte budget crosses)
//   down   = no line, and a plain textual state at the midpoint
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import { COLORS } from "@/lib/constants";
import { anchors } from "@/lib/sceneLayout";
import type { LinkVisual } from "@/lib/store";

/** The link ends at the dish, a little above the ground point. */
export function linkEarthEnd(out: THREE.Vector3) {
  return out.copy(anchors.station).addScaledVector(anchors.stationNormal, 0.14);
}

export function LinkLine({ link, windowLeftS }: { link: LinkVisual; windowLeftS: number | null }) {
  const line = useRef<Line2>(null);
  const label = useRef<THREE.Group>(null);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const initial = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], []);

  useFrame(() => {
    a.copy(anchors.craft);
    linkEarthEnd(b);
    line.current?.geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
    label.current?.position.lerpVectors(b, a, 0.42);
  });

  const color = link === "window" ? COLORS.caution : COLORS.accent;
  return (
    <group>
      <Line
        ref={line}
        points={initial}
        color={color}
        lineWidth={1.25}
        transparent
        opacity={link === "window" ? 0.95 : 0.7}
        visible={link !== "down"}
        frustumCulled={false}
      />
      <group ref={label}>
        {link !== "up" && (
          <Html zIndexRange={[30, 0]} style={{ pointerEvents: "none", transform: "translate(-50%, 14px)" }}>
            {link === "down" ? (
              <div className="scene-callout" style={{ borderColor: "rgba(255,107,91,0.55)" }}>
                <strong style={{ color: COLORS.warning }}>No link · loss of signal</strong>
                <span>Bundles are held on board until the next contact</span>
              </div>
            ) : (
              <div className="scene-callout" style={{ borderColor: "rgba(240,180,41,0.55)" }}>
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
