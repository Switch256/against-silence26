"""Build frontend/public/models/aegis1.glb from the NASA ISS (B) model (iss.glb).

- removes the detached truss pieces that float ~30 m above the station
- splits the solar-array blankets (material lambert7SG) into 8 wings (SAWs)
- parents them under two alpha-joint pivots (array_port / array_starboard)
  so a web app can rotate them to track the Sun
- assigns simple named PBR materials (the NASA model ships untextured grey)
- exports Draco-compressed aegis1.glb (same compression as the source iss.glb)

Run:  Blender -b -P tools/blender/prep_aegis1.py
"""
import bpy, bmesh, os, sys
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "frontend", "public", "models")
SRC = os.path.join(MODELS, "iss.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

# ---- 1. drop the floating parts (everything entirely above z=30 m) ----------
for o in list(bpy.data.objects):
    if o.type == "MESH":
        zs = [(o.matrix_world @ Vector(c)).z for c in o.bound_box]
        if min(zs) > 30.0:
            bpy.data.objects.remove(o, do_unlink=True)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
# apply transforms and join the station into one mesh
for o in meshes:
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
for o in list(bpy.data.objects):
    if o.type == "EMPTY":
        bpy.data.objects.remove(o, do_unlink=True)
ctx = bpy.context
for o in meshes:
    o.select_set(True)
ctx.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
station = ctx.view_layer.objects.active
station.name = "station"
station.data.name = "station"
# merge duplicate material slots (.001 copies)
bpy.ops.object.material_slot_remove_unused()

# ---- 2. materials ------------------------------------------------------------
def mat(name, col, metal, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m

M = {
    "solar_array": mat("solar_array", (0.035, 0.05, 0.11), 0.55, 0.28),
    "radiator": mat("radiator", (0.82, 0.82, 0.80), 0.0, 0.55),
    "truss": mat("truss", (0.62, 0.62, 0.62), 0.45, 0.45),
    "module": mat("module", (0.78, 0.77, 0.74), 0.1, 0.5),
    "detail_metal": mat("detail_metal", (0.55, 0.53, 0.5), 0.7, 0.35),
    "gold_foil": mat("gold_foil", (0.75, 0.55, 0.22), 0.9, 0.3),
}
mapping = {
    "lambert7SG": "solar_array", "soyuz_blinn4SG": "radiator", "lambert3SG": "truss",
    "blinn1SG": "module", "blinn3SG": "module", "blinn5SG": "module", "blinn4SG": "module",
    "lambert4SG": "radiator", "anisotropic1SG": "detail_metal", "apollohorns_blin": "gold_foil",
    "bendedtruss_blin": "detail_metal", "lambert6SG": "module", "lambert2SG": "detail_metal",
    "initialShadingGr": "detail_metal",
}
for i, slot in enumerate(station.material_slots):
    base = slot.material.name.split(".")[0]
    station.material_slots[i].material = M[mapping.get(base, "detail_metal")]
# collapse duplicate slots
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.object.mode_set(mode="OBJECT")
me = station.data
uniq = []
remap = {}
for i, m in enumerate(me.materials):
    if m not in uniq:
        uniq.append(m)
    remap[i] = uniq.index(m)
new_idx = [remap[p.material_index] for p in me.polygons]
me.materials.clear()
for m in uniq:
    me.materials.append(m)
me.polygons.foreach_set("material_index", new_idx)
me.update()
SA = uniq.index(M["solar_array"])

# ---- 3. split the array blankets into islands -------------------------------
bm = bmesh.new()
bm.from_mesh(me)
bm.faces.ensure_lookup_table()
sa_faces = {f for f in bm.faces if f.material_index == SA}
islands = []
seen = set()
for f in sa_faces:
    if f in seen:
        continue
    stack, isl = [f], []
    seen.add(f)
    while stack:
        g = stack.pop()
        isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h in sa_faces and h not in seen:
                    seen.add(h)
                    stack.append(h)
    islands.append(isl)

def centre(isl):
    vs = {v for f in isl for v in f.verts}
    return sum((v.co for v in vs), Vector()) / len(vs), vs

infos = []
for isl in islands:
    c, vs = centre(isl)
    zs = [v.co.z for v in vs]
    ys = [v.co.y for v in vs]
    infos.append(dict(faces=isl, c=c, zmin=min(zs), zmax=max(zs), ymin=min(ys), ymax=max(ys)))
print("array islands:", len(infos))

# truss height = middle of the gap between upper and lower blankets
upper = [i for i in infos if i["c"].z > 10.9]
lower = [i for i in infos if i["c"].z <= 10.9]
z_truss = 0.5 * (min(i["zmin"] for i in upper) + max(i["zmax"] for i in lower))
x_bl = sum(i["c"].x for i in infos) / len(infos)
print("truss z", z_truss, "blanket x", x_bl)

# group islands into SAWs: same side (y sign), same up/down, y-centres within 4 m
groups = []
for i in sorted(infos, key=lambda i: i["c"].y):
    key = (i["c"].y > 0, i["c"].z > z_truss)
    for g in groups:
        if g["key"] == key and abs(g["y"] - i["c"].y) < 4.0:
            g["items"].append(i)
            g["y"] = sum(k["c"].y for k in g["items"]) / len(g["items"])
            break
    else:
        groups.append(dict(key=key, y=i["c"].y, items=[i]))
print("SAW groups:", len(groups), [(g["key"], round(g["y"], 2), len(g["items"])) for g in groups])

# ---- 4. build objects ---------------------------------------------------------
def new_empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "ARROWS"
    e.empty_display_size = 2
    bpy.context.scene.collection.objects.link(e)
    if parent:
        e.parent = parent
        e.location = loc - parent.matrix_world.translation
    else:
        e.location = loc
    bpy.context.view_layer.update()
    return e

root = new_empty("AEGIS1", Vector((0, 0, 0)))
station.parent = root

sides = {}
for starboard in (False, True):
    gs = [g for g in groups if g["key"][0] == starboard]
    inner_y = min(abs(g["y"]) for g in gs)
    sgn = 1 if starboard else -1
    piv = Vector((x_bl, sgn * (inner_y - 3.0), z_truss))
    sides[starboard] = new_empty("array_starboard" if starboard else "array_port", piv, root)

wing_objs = []
for g in groups:
    starboard, up = g["key"]
    side = sides[starboard]
    gs = sorted([k for k in groups if k["key"] == g["key"]], key=lambda k: abs(k["y"]))
    rank = "inner" if gs[0] is g else "outer"
    name = f"saw_{'starboard' if starboard else 'port'}_{rank}_{'up' if up else 'down'}"
    zbase = min(i["zmin"] for i in g["items"]) if up else max(i["zmax"] for i in g["items"])
    piv = Vector((x_bl, g["y"], zbase))
    # copy faces into a new mesh
    nbm = bmesh.new()
    vmap = {}
    for it in g["items"]:
        for f in it["faces"]:
            nv = []
            for v in f.verts:
                if v not in vmap:
                    vmap[v] = nbm.verts.new(v.co - piv)
                nv.append(vmap[v])
            try:
                nf = nbm.faces.new(nv)
                nf.smooth = f.smooth
            except ValueError:
                pass
    nme = bpy.data.meshes.new(name)
    nbm.to_mesh(nme)
    nbm.free()
    nme.materials.append(M["solar_array"])
    ob = bpy.data.objects.new(name, nme)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = side
    ob.location = piv - side.matrix_world.translation
    wing_objs.append(ob)

# remove blanket faces from the station mesh
bmesh.ops.delete(bm, geom=list(sa_faces), context="FACES")
bm.to_mesh(me)
bm.free()
me.materials.pop(index=SA)
station.data.update()

for o in bpy.data.objects:
    print("NODE", o.name, o.type, o.parent.name if o.parent else "-", tuple(round(v, 3) for v in o.location),
          len(o.data.polygons) if o.type == "MESH" else "")

# ---- 5. export ------------------------------------------------------------------
common = dict(export_format="GLB", export_apply=True, export_yup=True, use_selection=False,
              export_materials="EXPORT", export_normals=True,
              export_animations=False, export_extras=False)
out = os.path.join(MODELS, "aegis1.glb")
bpy.ops.export_scene.gltf(filepath=out, export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=7, export_draco_position_quantization=14,
                          export_draco_normal_quantization=10, **common)
print("WROTE", out, os.path.getsize(out))
