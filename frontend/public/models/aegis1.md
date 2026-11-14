# aegis1.glb: AEGIS-1 spacecraft (web model)

Built from the NASA 3D Resources model **International Space Station (ISS) (B)** (`iss.glb`) by
`tools/blender/prep_aegis1.py` (Blender 5.2). Re-run with:

```
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/prep_aegis1.py
```

## What changed compared with iss.glb

- The 7 detached truss pieces that floated about 30 m above the station (`bendedtru*`, `pCylinder*`) have been removed.
- The 8 solar-array wings (SAWs) are now separate nodes, each pivoted at its mast base. They hang under two alpha-joint
  pivots, one per side, so the arrays can be turned to face the Sun.
- Transforms are applied. The coordinate frame, scale and origin are **the same as iss.glb**, so existing placement code still works.
- The NASA model ships with no textures (every material was the same flat grey). It now has 6 named PBR materials:
  `solar_array` (dark blue, slightly metallic), `module`, `truss`, `radiator`, `detail_metal`, `gold_foil`.
- Draco mesh compression, same as `iss.glb` (`KHR_draco_mesh_compression` is required). The file is 389 KB, against 477 KB for iss.glb.

## Node tree

```
AEGIS1                      (root, identity transform)
├── station                 (mesh: modules, truss, radiators, details; ~172k tris)
├── array_port              (empty, alpha-joint pivot, position (-1.146, 10.800, +11.689))
│   ├── saw_port_inner_up       (mesh, local position (0, +1.113, 3.000))
│   ├── saw_port_inner_down     (mesh, local position (0, -1.113, 3.000))
│   ├── saw_port_outer_up       (mesh, local position (0, +1.113, 9.294))
│   └── saw_port_outer_down     (mesh, local position (0, -1.113, 9.294))
└── array_starboard         (empty, alpha-joint pivot, position (-1.146, 10.800, -11.874))
    ├── saw_starboard_inner_up  (0, +1.113, -3.000)
    ├── saw_starboard_inner_down
    ├── saw_starboard_outer_up  (0, +1.113, -9.294)
    └── saw_starboard_outer_down
```

All the positions above are glTF / three.js coordinates (Y up), in metres.

## Frame, scale and orientation (glTF / three.js, Y up)

- Units are metres. The whole model spans about x -2.8..3.3, y -4.2..25.8 and z -22.9..23.1 (truss about 45 m long).
- The **truss runs along Z**. "Port" is the +Z end and "starboard" is the -Z end. These are labels for this model only,
  not the real ISS body frame.
- The pressurised module stack runs along **Y**, from y ≈ -3 up to about 16. The truss sits at y = 10.8.
- The array blankets lie in the **YZ plane** (thin in X). The wing lengths run along ±Y: "up" wings span y 0 to +13.9 from their pivot, "down" wings 0 to -13.9.
- The origin is near the bottom of the module stack, not at the centre of mass. To centre the model, offset it by about (0, -11, 0).

## Rotating the arrays in three.js

Two joints, as on the real station:

| Joint | Node(s) | Axis (local) | Effect |
| --- | --- | --- | --- |
| Alpha (SARJ) | `array_port`, `array_starboard` | **Z** (the truss axis) | rolls all 4 wings on that side around the truss |
| Beta (BGA) | `saw_*` | **Y** (the mast, along the wing) | twists one wing about its own long axis |

The blanket normal at rest is ±X.

```js
const { scene } = useGLTF('/models/aegis1.glb'); // drei sets up the Draco decoder automatically
const port = scene.getObjectByName('array_port');
const stbd = scene.getObjectByName('array_starboard');
const wings = [];
scene.traverse(o => { if (o.name.startsWith('saw_')) wings.push(o); });

// sunDirWorld: unit vector from the spacecraft towards the Sun (world space)
useFrame(() => {
  // put the sun direction into the array pivot's parent space (AEGIS1 root)
  const root = port.parent;
  const s = sunDirWorld.clone().transformDirection(root.matrixWorld.clone().invert());
  // alpha: rotate about Z so the blanket normal (+X) points at the Sun's projection on the XY plane
  const alpha = Math.atan2(s.y, s.x);
  port.rotation.z = alpha;
  stbd.rotation.z = alpha;
  // beta: optional small tilt toward the out-of-plane component of the Sun
  const beta = Math.asin(THREE.MathUtils.clamp(s.z, -1, 1)) * 0.5;
  wings.forEach(w => (w.rotation.y = -beta));
});
```

Notes:
- Blankets are single-sided quads. Render `solar_array` with `side: THREE.DoubleSide` (the exporter normally marks
  it double-sided already), so both faces of the arrays are visible while they rotate.
- A slow idle animation looks good too, e.g. `port.rotation.z = base + 0.05 * Math.sin(t * 0.3)`.
- The beta range on the real ISS is unlimited, but keep it to about ±30° so the wings don't hit the radiators.
