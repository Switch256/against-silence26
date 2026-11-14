"use client";
// A small label that appears only on hover (or when `show` is set), so secondary bodies
// never add permanent clutter. `hitRadius` is an invisible sphere that makes tiny models hoverable.
import { Html } from "@react-three/drei";
import { useState, type ReactNode } from "react";

interface Props {
  label: ReactNode;
  hitRadius: number;
  show?: boolean;
  offset?: [number, number, number];
  children: ReactNode;
}

export function HoverLabel({ label, hitRadius, show = false, offset = [0, 0, 0], children }: Props) {
  const [hover, setHover] = useState(false);
  return (
    <group>
      {children}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[hitRadius, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(hover || show) && (
        <Html position={offset} zIndexRange={[22, 0]} style={{ pointerEvents: "none" }}>
          <div className="scene-label" style={{ transform: "translate(8px, -50%)" }}>{label}</div>
        </Html>
      )}
    </group>
  );
}
