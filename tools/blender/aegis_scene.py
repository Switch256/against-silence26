"""AEGIS-MEDLINK cinematic loops (EEVEE), built entirely from NASA assets + procedural shaders.

  Blender -b -P tools/blender/aegis_scene.py -- --mode hero  --out <dir> [--frames 1,60,120] [--scale 50] [--samples 32]
  Blender -b -P tools/blender/aegis_scene.py -- --mode story --out <dir>

Writes PNG frames <out>/f_0001.png ... (seamless loop: frame N+1 == frame 1).
Encode afterwards with tools/blender/encode_video.py.

NASA sources: frontend/public/models/aegis1.glb (from NASA ISS (B), see prep_aegis1.py),
frontend/public/textures/nasa/* (Blue Marble, Black Marble 2012, SVS 3615 clouds, ocean mask).
Stars, atmosphere, sun, beam, packets and nav lights are procedural.
"""
import bpy, math, os, sys, argparse
from mathutils import Vector, Matrix, Euler, Quaternion

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUB = os.path.join(ROOT, "frontend", "public")
TEX = os.path.join(PUB, "textures", "nasa")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", default="hero")
ap.add_argument("--out", required=True)
ap.add_argument("--frames", default="")
ap.add_argument("--scale", type=int, default=100)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--fps", type=int, default=24)
ap.add_argument("--seconds", type=float, default=10.0)
A = ap.parse_args(argv)
os.makedirs(A.out, exist_ok=True)

FPS = A.fps
N = int(round(A.seconds * FPS))          # frames in the loop
R = 6371.0                               # Earth radius (scene units = km)
H_CAM = float(os.environ.get("H_CAM", 2600.0))                          # camera altitude above the surface (cinematic cheat)
TAU = 2 * math.pi

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
sc.render.resolution_percentage = A.scale
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, N
sc.eevee.taa_render_samples = A.samples
sc.eevee.use_shadows = True
sc.render.film_transparent = False
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_depth = "8"
try:
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
except Exception:
    try:
        sc.view_settings.look = "Medium High Contrast"
    except Exception:
        pass
sc.view_settings.exposure = 0.0


# ----------------------------------------------------------------------------- helpers
def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def img(nt, fname, noncolor=False, interp="Cubic"):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = bpy.data.images.load(os.path.join(TEX, fname), check_existing=True)
    if noncolor:
        n.image.colorspace_settings.name = "Non-Color"
    n.interpolation = interp
    return n


def math_node(nt, op, a=None, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def vmath(nt, op, a=None, b=None, scale=None):
    n = nt.nodes.new("ShaderNodeVectorMath")
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (tuple, list, Vector)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    if scale is not None:
        n.inputs[3].default_value = scale
    return n


def maprange(nt, x, a, b, c=0.0, d=1.0, smooth=True):
    n = nt.nodes.new("ShaderNodeMapRange")
    n.interpolation_type = "SMOOTHSTEP" if smooth else "LINEAR"
    nt.links.new(x, n.inputs[0])
    n.inputs[1].default_value, n.inputs[2].default_value = a, b
    n.inputs[3].default_value, n.inputs[4].default_value = c, d
    return n.outputs[0]


def add_obj(name, data, coll=None):
    o = bpy.data.objects.new(name, data)
    (coll or sc.collection).objects.link(o)
    return o


def sphere(name, r, seg=64, ring=32):
    me = bpy.data.meshes.new(name)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=r, calc_uvs=True)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    return add_obj(name, me)


def emission_mat(name, col, strength):
    m, nt, out = node_mat(name)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*col, 1)
    e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], out.inputs[0])
    return m, e


# ----------------------------------------------------------------------------- camera
cam = add_obj("Camera", bpy.data.cameras.new("Camera"))
sc.camera = cam
cam.data.lens = 35 if A.mode == "hero" else 50
cam.data.sensor_width = 36
cam.data.clip_start = 0.5
cam.data.clip_end = 30000

EARTH_C = Vector((0, 0, -(R + H_CAM)))
dip = math.acos(R / (R + H_CAM))                         # horizon dip angle
hfov = 2 * math.atan(18 / cam.data.lens)
vfov = 2 * math.atan(math.tan(hfov / 2) * 9 / 16)
HORIZON_Y = 0.40 if A.mode == "hero" else 0.30           # horizon height (fraction of frame from bottom)
alpha = math.atan((HORIZON_Y - 0.5) * 2 * math.tan(vfov / 2))
PITCH = -dip - alpha                                     # camera elevation angle (negative = looking down)


def cam_basis(yaw, pitch, roll=0.0):
    return Euler((math.pi / 2 + pitch, roll, yaw), "XYZ")


def screen_dir(u, v, rot):
    """world direction through screen point (u,v in 0..1, v from bottom)"""
    x = (u - 0.5) * 2 * math.tan(hfov / 2)
    y = (v - 0.5) * 2 * math.tan(vfov / 2)
    d = Vector((x, y, -1)).normalized()
    return (rot.to_matrix() @ d).normalized()


# ----------------------------------------------------------------------------- sun
SUN_AZ = math.radians(float(os.environ.get("SUN_AZ", 50)))   # left of forward
SUN_EL = math.radians(float(os.environ.get("SUN_EL", -14)))
L = Vector((-math.sin(SUN_AZ) * math.cos(SUN_EL), math.cos(SUN_AZ) * math.cos(SUN_EL), math.sin(SUN_EL))).normalized()
sun = add_obj("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 4.2
sun.data.color = (1.0, 0.94, 0.86)
sun.data.angle = math.radians(0.6)
sun.rotation_euler = (-L).to_track_quat("-Z", "Y").to_euler()
# earthshine fill from below (blue-ish, weak)
fill = add_obj("Earthshine", bpy.data.lights.new("Earthshine", "SUN"))
fill.data.energy = 1.8
fill.data.color = (0.55, 0.7, 1.0)
fill.data.use_shadow = False
fill.rotation_euler = Vector((0.2, -0.3, 1)).to_track_quat("-Z", "Y").to_euler()

# ----------------------------------------------------------------------------- world: deep space + sparse stars
w = bpy.data.worlds.new("Space")
sc.world = w
w.use_nodes = True
nt = w.node_tree
nt.nodes.clear()
wo = nt.nodes.new("ShaderNodeOutputWorld")
bg = nt.nodes.new("ShaderNodeBackground")
tc = nt.nodes.new("ShaderNodeTexCoord")
vor = nt.nodes.new("ShaderNodeTexVoronoi")
vor.inputs["Scale"].default_value = 420
nt.links.new(tc.outputs["Generated"], vor.inputs["Vector"])
# keep only ~1.2% of cells, small round dots
rnd = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(vor.outputs["Color"], rnd.inputs[0])
keep = math_node(nt, "GREATER_THAN", rnd.outputs[0], 0.9935)
dot = maprange(nt, vor.outputs["Distance"], 0.18, 0.0)
bright = maprange(nt, rnd.outputs[1], 0.0, 1.0, 0.05, 0.9, smooth=False)
star = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", keep, dot), bright)
mixc = nt.nodes.new("ShaderNodeMix")
mixc.data_type = "RGBA"
nt.links.new(star, mixc.inputs[0])
mixc.inputs[6].default_value = (0.0006, 0.0008, 0.0014, 1)
mixc.inputs[7].default_value = (0.9, 0.93, 1.0, 1)
nt.links.new(mixc.outputs[2], bg.inputs[0])
bg.inputs[1].default_value = 1.0
nt.links.new(bg.outputs[0], wo.inputs[0])
w_light = w  # world contributes almost no light (black space)

# ----------------------------------------------------------------------------- Earth
earth = sphere("Earth", R, seg=384, ring=192)
earth.location = EARTH_C
earth.visible_shadow = False


def _ray_sphere(o, dvec, c, r):
    oc = o - c
    b = oc.dot(dvec)
    disc = b * b - (oc.dot(oc) - r * r)
    if disc < 0:
        return None
    return o + dvec * (-b - math.sqrt(disc))


def earth_rotation(lat, lon, uv, twist_deg):
    """rotate Earth so geographic (lat,lon) sits under screen point uv, north pointing towards the horizon"""
    la, lo = math.radians(lat), math.radians(lon)
    g = Vector((math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)))
    ng_ = Vector((-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)))
    P = _ray_sphere(Vector((0, 0, 0)), screen_dir(*uv, cam_basis(0.0, PITCH)), EARTH_C, R)
    t = (P - EARTH_C).normalized()
    fwd = Vector((0, 1, 0))
    nw = (fwd - t * fwd.dot(t)).normalized()
    nw = Quaternion(t, math.radians(twist_deg)) @ nw
    Mg = Matrix((g, ng_, g.cross(ng_))).transposed()
    Mw = Matrix((t, nw, t.cross(nw))).transposed()
    return (Mw @ Mg.transposed()).to_euler()

TARGET = [float(x) for x in os.environ.get("EARTH_TARGET", "33,28,0.55,0.20,-12").split(",")]
EARTH_ROT = earth_rotation(TARGET[0], TARGET[1], (TARGET[2], TARGET[3]), TARGET[4])
earth.rotation_euler = EARTH_ROT
m, nt, out = node_mat("EarthSurface")
earth.data.materials.append(m)
tc_e = nt.nodes.new("ShaderNodeTexCoord")
sxyz = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(tc_e.outputs["Object"], sxyz.inputs[0])
lon = math_node(nt, "ARCTAN2", sxyz.outputs["Y"], sxyz.outputs["X"])
lat = math_node(nt, "ARCSINE", math_node(nt, "DIVIDE", sxyz.outputs["Z"], R, clamp=False))
cxyz = nt.nodes.new("ShaderNodeCombineXYZ")
nt.links.new(math_node(nt, "ADD", math_node(nt, "DIVIDE", lon, TAU), 0.5), cxyz.inputs[0])
nt.links.new(math_node(nt, "ADD", math_node(nt, "DIVIDE", lat, math.pi), 0.5), cxyz.inputs[1])
class _UV: outputs = {"UV": cxyz.outputs[0]}
uv = _UV
# 8192x4096 Blue Marble (SVS 2915 east+west 4096 halves, stitched) for crisp full-screen video;
# falls back to the web 2048 texture if it is missing.
_DAY8K = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures", "earth_day_bluemarble_8192.jpg")
day = img(nt, _DAY8K if os.path.exists(_DAY8K) else "earth_day_bluemarble_2048.jpg")
night = img(nt, "earth_black_marble_2012_3600.jpg")
cloud = img(nt, "earth_clouds_svs3615_2048.png", noncolor=True)
ocean = img(nt, "earth_ocean_mask_2048.png", noncolor=True)
cloud_uv = vmath(nt, "ADD", uv.outputs["UV"], (0.0, 0.0, 0.0))     # animated tiny drift
CLOUD_OFF = cloud_uv
for n in (day, night, ocean):
    nt.links.new(uv.outputs["UV"], n.inputs[0])
nt.links.new(cloud_uv.outputs[0], cloud.inputs[0])
cl = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(cloud.outputs[0], cl.inputs[0])
cfac = maprange(nt, cl.outputs[0], 0.08, 0.85, 0.0, 1.0)
# slightly richer day colour
hsv = nt.nodes.new("ShaderNodeHueSaturation")
hsv.inputs["Saturation"].default_value = 1.12
hsv.inputs["Value"].default_value = 0.95
nt.links.new(day.outputs[0], hsv.inputs["Color"])
alb = nt.nodes.new("ShaderNodeMix")
alb.data_type = "RGBA"
nt.links.new(cfac, alb.inputs[0])
nt.links.new(hsv.outputs[0], alb.inputs[6])
alb.inputs[7].default_value = (0.92, 0.93, 0.95, 1)
oc = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(ocean.outputs[0], oc.inputs[0])
ocean_clear = math_node(nt, "MULTIPLY", oc.outputs[0], math_node(nt, "SUBTRACT", 1.0, cfac))
rough = maprange(nt, ocean_clear, 0.0, 1.0, 0.85, 0.32, smooth=False)
spec = maprange(nt, ocean_clear, 0.0, 1.0, 0.15, 0.75, smooth=False)
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
nt.links.new(alb.outputs[2], bsdf.inputs["Base Color"])
nt.links.new(rough, bsdf.inputs["Roughness"])
nt.links.new(spec, bsdf.inputs["Specular IOR Level"])
# night lights: emission where N.L < 0
geo = nt.nodes.new("ShaderNodeNewGeometry")
ndl = vmath(nt, "DOT_PRODUCT", geo.outputs["Normal"], tuple(L))
nightf = maprange(nt, ndl.outputs["Value"], 0.06, -0.12)
# Black Marble: lights are yellow, background is dark blue -> key the red channel
nsep = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(night.outputs[0], nsep.inputs[0])
lkey = math_node(nt, "POWER", maprange(nt, nsep.outputs[0], 0.18, 1.0, 0.0, 1.0, smooth=False), 1.8)
lcurve = nt.nodes.new("ShaderNodeCombineColor")
for i in range(3):
    nt.links.new(lkey, lcurve.inputs[i])
tint = nt.nodes.new("ShaderNodeMix")
tint.data_type = "RGBA"
tint.blend_type = "MULTIPLY"
tint.inputs[0].default_value = 1.0
nt.links.new(lcurve.outputs[0], tint.inputs[6])
tint.inputs[7].default_value = (1.0, 0.62, 0.30, 1)
lstr = math_node(nt, "MULTIPLY", nightf, math_node(nt, "SUBTRACT", 1.0, math_node(nt, "MULTIPLY", cfac, 0.85)))
EARTH_LIGHTS_STRENGTH = math_node(nt, "MULTIPLY", lstr, float(os.environ.get("LIGHTS", 0.32)))
nt.links.new(tint.outputs[2], bsdf.inputs["Emission Color"])
nt.links.new(EARTH_LIGHTS_STRENGTH, bsdf.inputs["Emission Strength"])
nt.links.new(bsdf.outputs[0], out.inputs[0])

# ----------------------------------------------------------------------------- atmosphere shell
ATM_H = 95.0
atm = sphere("Atmosphere", R + ATM_H, seg=384, ring=192)
atm.location = EARTH_C
atm.visible_shadow = False
m, nt, out = node_mat("Atmosphere")
m.surface_render_method = "BLENDED"
m.use_backface_culling = True
atm.data.materials.append(m)
tco = nt.nodes.new("ShaderNodeTexCoord")
geo = nt.nodes.new("ShaderNodeNewGeometry")
Q = tco.outputs["Object"]                     # point relative to Earth centre
I = geo.outputs["Incoming"]                   # towards camera
proj = vmath(nt, "DOT_PRODUCT", Q, I)
projv = vmath(nt, "SCALE", I)
nt.links.new(proj.outputs["Value"], projv.inputs["Scale"])
perp = vmath(nt, "SUBTRACT", Q, projv.outputs[0])
d = vmath(nt, "LENGTH", perp.outputs[0])
alt = math_node(nt, "SUBTRACT", d.outputs["Value"], R)          # ray tangent altitude (km), <0 hits Earth
above = math_node(nt, "GREATER_THAN", alt, 0.0)
outer = math_node(nt, "MULTIPLY", math_node(nt, "EXPONENT", math_node(nt, "DIVIDE", math_node(nt, "MAXIMUM", alt, 0.0), -16.0)), above)
inner = math_node(nt, "EXPONENT", math_node(nt, "DIVIDE", math_node(nt, "MINIMUM", alt, 0.0), 140.0))
fade_top = maprange(nt, alt, ATM_H * 0.98, ATM_H * 0.55)        # avoid hard shell edge
glow = math_node(nt, "MULTIPLY", math_node(nt, "MAXIMUM", outer, math_node(nt, "MULTIPLY", inner, 0.45)), fade_top)
glow = math_node(nt, "MULTIPLY", glow, math_node(nt, "SUBTRACT", 1.0, math_node(nt, "MULTIPLY", maprange(nt, alt, -0.1, -900.0), 0.0)))
# illumination: tangent point direction vs sun
nperp = vmath(nt, "NORMALIZE", perp.outputs[0])
s = vmath(nt, "DOT_PRODUCT", nperp.outputs[0], tuple(L))
ramp = nt.nodes.new("ShaderNodeValToRGB")
nt.links.new(s.outputs["Value"], ramp.inputs[0])
# map s (-1..1) -> 0..1 first
smap = maprange(nt, s.outputs["Value"], -0.35, 0.6, 0.0, 1.0, smooth=False)
nt.links.new(smap, ramp.inputs[0])
cr = ramp.color_ramp
cr.elements[0].position = 0.0
cr.elements[0].color = (0, 0, 0, 1)
e = cr.elements.new(0.26); e.color = (0.10, 0.03, 0.06, 1)
e = cr.elements.new(0.36); e.color = (0.95, 0.35, 0.10, 1)      # twilight band
e = cr.elements.new(0.48); e.color = (0.55, 0.62, 0.95, 1)
cr.elements[-1].position = 1.0
cr.elements[-1].color = (0.30, 0.55, 1.0, 1)
# forward scattering boost towards the sun
fwd = vmath(nt, "DOT_PRODUCT", I, tuple(-L))
fws = math_node(nt, "POWER", math_node(nt, "MAXIMUM", fwd.outputs["Value"], 0.0), 6.0)
boost = math_node(nt, "ADD", 1.0, math_node(nt, "MULTIPLY", fws, 1.5))
ATM_STRENGTH = nt.nodes.new("ShaderNodeValue")
ATM_STRENGTH.outputs[0].default_value = float(os.environ.get("ATM", 1.0))
strength = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", glow, boost), ATM_STRENGTH.outputs[0])
em = nt.nodes.new("ShaderNodeEmission")
nt.links.new(ramp.outputs[0], em.inputs[0])
nt.links.new(strength, em.inputs[1])
tr = nt.nodes.new("ShaderNodeBsdfTransparent")
add = nt.nodes.new("ShaderNodeAddShader")
nt.links.new(em.outputs[0], add.inputs[0])
nt.links.new(tr.outputs[0], add.inputs[1])
nt.links.new(add.outputs[0], out.inputs[0])

# ----------------------------------------------------------------------------- spacecraft
bpy.ops.import_scene.gltf(filepath=os.path.join(PUB, "models", "aegis1.glb"))
iss = bpy.data.objects["AEGIS1"]
saws = {o.name: o for o in bpy.data.objects if o.name.startswith("saw_")}
arr_port, arr_stbd = bpy.data.objects["array_port"], bpy.data.objects["array_starboard"]
# slightly more filmic materials
bpy.data.materials["solar_array"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.03, 0.045, 0.10, 1)
for mn in ("module", "radiator"):
    b = bpy.data.materials[mn].node_tree.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.6

# model axes -> world: X->up, Y->right, Z->forward ; then yaw/roll per frame
BASE = Matrix(((0, 1, 0), (0, 0, 1), (1, 0, 0))).to_4x4()
ISS_SCALE = 1.0

# earthshine fill lights only the spacecraft (light linking), never the Earth's night side
iss_coll = bpy.data.collections.new("SpacecraftLit")
sc.collection.children.link(iss_coll)
for o in [iss] + list(iss.children_recursive):
    if o.type == "MESH":
        iss_coll.objects.link(o)
fill.light_linking.receiver_collection = iss_coll

# nav lights (model coordinates)
def nav_light(name, col, loc, r=0.22):
    o = sphere(name, r, 16, 8)
    mt, emn = emission_mat(name + "_m", col, 0.0)
    o.data.materials.append(mt)
    o.parent = iss
    o.location = loc
    o.visible_shadow = False
    return emn

NAV = [
    (nav_light("nav_port", (1.0, 0.08, 0.05), Vector((-1.1, -22.9, 10.8))), 0.0, 60.0),
    (nav_light("nav_stbd", (0.1, 1.0, 0.3), Vector((-1.1, 23.1, 10.8))), 0.0, 60.0),
    (nav_light("nav_strobe", (1.0, 1.0, 1.0), Vector((-3.1, 0.0, 6.0)), 0.16), 0.5, 140.0),
]

# ----------------------------------------------------------------------------- link beam + packets
def beam_obj(name):
    me = bpy.data.meshes.new(name)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=16, radius1=1.0, radius2=4.0, depth=1.0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.5))
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    o = add_obj(name, me)
    o.visible_shadow = False
    m, nt, out = node_mat(name + "_m")
    m.surface_render_method = "BLENDED"
    o.data.materials.append(m)
    tco = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tco.outputs["Generated"], sep.inputs[0])
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs[0].default_value = 0.5
    core = 1.0   # (Layer Weight is unreliable on this extremely stretched cylinder)
    z = sep.outputs["Z"]                                      # 0 at spacecraft, 1 at ground
    fade = maprange(nt, z, 0.0, 0.02, 0.0, 1.0)                # soft start
    fade_end = maprange(nt, z, 1.0, 0.55, 0.25, 1.0, smooth=False)
    phase = nt.nodes.new("ShaderNodeValue")                   # animated
    dash = math_node(nt, "ADD", 0.65, math_node(nt, "MULTIPLY", 0.35,
                     math_node(nt, "SINE", math_node(nt, "SUBTRACT", math_node(nt, "MULTIPLY", z, 90.0), phase.outputs[0]))))
    strengthv = nt.nodes.new("ShaderNodeValue")
    strengthv.outputs[0].default_value = 3.0
    st = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", fade, core), fade_end), dash)
    st = math_node(nt, "MULTIPLY", st, strengthv.outputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (0.12, 0.42, 1.0, 1)
    nt.links.new(st, em.inputs[1])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    ad = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(em.outputs[0], ad.inputs[0])
    nt.links.new(tr.outputs[0], ad.inputs[1])
    nt.links.new(ad.outputs[0], out.inputs[0])
    return o, phase.outputs[0], strengthv.outputs[0], em

beam, BEAM_PHASE, BEAM_STR, BEAM_EM = beam_obj("LinkBeam")


def packet(name, col, r=0.55, strength=40.0):
    o = sphere(name, r, 24, 12)
    m, e = emission_mat(name + "_m", col, strength)
    o.data.materials.append(m)
    o.visible_shadow = False
    return o, e

ground, GROUND_EM = packet("GroundStation", (0.3, 0.6, 1.0), r=6.0, strength=6.0)


def place_beam(o, a, b, radius):
    d = b - a
    o.location = a
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    o.scale = (radius, radius, d.length)


# ----------------------------------------------------------------------------- compositor: soft bloom + vignette
def setup_comp():
    ng = bpy.data.node_groups.new("Comp", "CompositorNodeTree")
    sc.compositing_node_group = ng
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    go = ng.nodes.new("NodeGroupOutput")
    gl = ng.nodes.new("CompositorNodeGlare")
    for k, v in (("Type", "Bloom"), ("Quality", "High")):
        try:
            gl.inputs[k].default_value = v
        except Exception as ex:
            print("glare", k, ex)
    gl.inputs["Threshold"].default_value = 1.0
    gl.inputs["Strength"].default_value = 0.4
    gl.inputs["Size"].default_value = 0.6
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    last = gl.outputs[0]
    try:
        el = ng.nodes.new("CompositorNodeEllipseMask")
        el.inputs["Size"].default_value = (1.15, 1.25)
        bl = ng.nodes.new("CompositorNodeBlur")
        bl.inputs["Size"].default_value = (int(380 * A.scale / 100), int(380 * A.scale / 100))
        ng.links.new(el.outputs[0], bl.inputs["Image"])
        mr = ng.nodes.new("ShaderNodeMapRange")
        ng.links.new(bl.outputs[0], mr.inputs[0])
        mr.inputs[3].default_value = 0.70
        mr.inputs[4].default_value = 1.0
        mx = ng.nodes.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        mx.blend_type = "MULTIPLY"
        mx.inputs[0].default_value = 1.0
        ng.links.new(last, mx.inputs[6])
        ng.links.new(mr.outputs[0], mx.inputs[7])
        last = mx.outputs[2]
    except Exception as ex:
        print("vignette skipped:", ex)
    ng.links.new(last, go.inputs[0])

try:
    setup_comp()
except Exception as ex:
    print("COMPOSITOR SETUP FAILED", ex)


# ----------------------------------------------------------------------------- animation (pure functions of loop phase)
def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def solve_alpha(iss_rot, campos, isspos):
    """alpha angle that tilts the array normals so they glint toward the camera"""
    V = (campos - isspos).normalized()
    Hh = (L * 0.35 + V * 0.65).normalized()
    best, ba = -2, 0
    for k in range(360):
        a = math.radians(k)
        n_model = Vector((math.cos(a), 0, -math.sin(a)))     # blanket normal (+X) rotated about Y
        n = (iss_rot @ n_model)
        val = abs(n.dot(Hh))
        if val > best:
            best, ba = val, a
    return ba


CAM_YAW0 = 0.0
REST_ROT = cam_basis(CAM_YAW0, PITCH)
if A.mode == "hero":
    ISS_UV = tuple(float(x) for x in os.environ.get("ISS_UV", "0.63,0.34").split(","))
    ISS_DIST = float(os.environ.get("ISS_DIST", 172.0))
else:
    ISS_UV = (0.47, 0.55)
    ISS_DIST = 165.0
ISS_POS0 = screen_dir(*ISS_UV, REST_ROT) * ISS_DIST
GROUND_DIR_UV = (0.50, 0.05) if A.mode == "hero" else (0.24, 0.07)


def ray_sphere(o, dvec, c, r):
    oc = o - c
    b = oc.dot(dvec)
    disc = b * b - (oc.dot(oc) - r * r)
    if disc < 0:
        return None
    return o + dvec * (-b - math.sqrt(disc))


GROUND_PT = ray_sphere(Vector((0, 0, 0)), screen_dir(*GROUND_DIR_UV, REST_ROT), EARTH_C, R + 0.5)
ground.location = GROUND_PT
print("dip deg", math.degrees(dip), "pitch", math.degrees(PITCH), "ground", GROUND_PT)

alpha_cached = None
ISS_YAW, ISS_ROLL, ISS_PITCH, ALPHA_OFF = [float(x) for x in os.environ.get("ISS_ATT", "-50,6,-4,0").split(",")]


def set_frame(f):
    global alpha_cached
    t = ((f - 1) % N) / N          # 0..1, loop phase
    ph = TAU * t
    # camera: slow circular sway + gentle dolly in/out (cyclic)
    off = Vector((2.4 * math.sin(ph), -4.0 * math.cos(ph) + 4.0, 1.2 * math.sin(2 * ph)))
    cam.location = off
    look = ISS_POS0 * 1.0
    yaw = CAM_YAW0 + math.radians(0.9) * math.sin(ph + 0.6)
    pitch = PITCH + math.radians(0.35) * math.cos(ph)
    roll = math.radians(0.6) * math.sin(ph + 1.3)
    cam.rotation_euler = cam_basis(yaw, pitch, roll)
    # spacecraft: drifting glide across a small ellipse, slow attitude wobble
    drift = Vector((3.2 * math.cos(ph), 2.0 * math.sin(ph), 0.8 * math.sin(ph)))
    yaw_i = math.radians(ISS_YAW + 4.0 * math.sin(ph))
    roll_i = math.radians(ISS_ROLL + 2.0 * math.cos(ph))
    pitch_i = math.radians(ISS_PITCH + 1.5 * math.sin(ph + 0.8))
    rot = (Euler((pitch_i, roll_i, yaw_i), "XYZ").to_matrix().to_4x4() @ BASE)
    pos = ISS_POS0 + drift
    iss.matrix_world = Matrix.Translation(pos) @ rot @ Matrix.Scale(ISS_SCALE, 4)
    if alpha_cached is None:
        alpha_cached = solve_alpha(rot.to_3x3(), Vector((0, 0, 0)), ISS_POS0) + math.radians(ALPHA_OFF)
    a = alpha_cached + math.radians(3.0) * math.sin(ph)
    arr_port.rotation_mode = arr_stbd.rotation_mode = "XYZ"
    arr_port.rotation_euler = (0, a, 0)
    arr_stbd.rotation_euler = (0, a, 0)
    # beta gimbals sweep -> the sun glint travels across the wings
    for i, (n, o) in enumerate(sorted(saws.items())):
        o.rotation_euler = (0, 0, math.radians(7.0) * math.sin(ph + i * 0.7))
    # nav lights: integer number of blinks per loop
    for k, (emn, phase0, peak) in enumerate(NAV):
        if k < 2:
            per = FPS * 1.25 if N % int(FPS * 1.25) == 0 else FPS
            x = ((f - 1 + phase0 * per + k * 3) % per) / per
            v = peak * (smooth((0.12 - x) / 0.12 + 1) if x < 0.12 else max(0.0, 1 - (x - 0.12) / 0.25)) * 0.9 + 1.5
        else:
            per = FPS                           # strobe: double flash every second
            x = (f - 1) % per
            v = peak if x in (0, 3) else 0.0
        emn.inputs[1].default_value = v
    # link beam from spacecraft belly to the ground station
    start = iss.matrix_world @ Vector((-3.2, 0.0, 7.5))
    place_beam(beam, start, GROUND_PT, 0.14)
    BEAM_PHASE.default_value = TAU * 6 * t * 1.0 * 4      # dashes flow downwards (integer cycles per loop)
    pulse = 0.5 + 0.5 * math.sin(TAU * 2 * t)
    BEAM_STR.default_value = 1.2 + 1.4 * pulse
    # PulseBrief packet: travels spacecraft -> ground between t=0.12 and t=0.62
    return start, t


start_pk, PK_EM = packet("PulseBrief", (1.0, 0.10, 0.05), r=0.85, strength=28.0)
start_pk.hide_render = True


def set_packets(f):
    start, t = set_frame(f)
    tp = (t - 0.10) / 0.55
    if 0.0 <= tp <= 1.0:
        s = smooth(tp) ** 1.6
        start_pk.hide_render = False
        start_pk.location = start.lerp(GROUND_PT, s)
        k = 1.0 + 0.0 * s
        start_pk.scale = (k, k, k)
    else:
        start_pk.hide_render = True
    # ground station flashes when the packet lands
    land = (t - 0.65) / 0.18
    GROUND_EM.inputs[1].default_value = 5.0 + (30.0 * math.exp(-4 * land) if 0 <= land <= 1 else 0.0)


# ----------------------------------------------------------------------------- story clip: link breaks, bundles queue, link returns
if A.mode == "story":
    import random
    SP = [packet("pk_headline", (1.0, 0.08, 0.04), 0.8, 9.0),
          packet("pk_context", (1.0, 0.42, 0.03), 0.8, 7.0),
          packet("pk_evidence", (0.08, 0.35, 1.0), 0.8, 10.0)]
    REPLY = packet("pk_reply", (0.15, 1.0, 0.30), 1.5, 14.0)
    for o, e in SP + [REPLY]:
        o.hide_render = True
    APPEAR = [0.20, 0.27, 0.34]
    SEND = [(0.55, 0.70), (0.63, 0.78), (0.71, 0.86)]
    REPLY_T = (0.84, 0.98)
    rng = random.Random(7)
    FLICK = {f: rng.random() for f in range(1, N + 2)}

    def beam_level(t, f):
        if t < 0.12:
            return 1.0
        if t < 0.22:                              # dying flicker
            return (1.0 if FLICK[f] > (t - 0.12) / 0.10 else 0.05) * (1 - (t - 0.12) / 0.12)
        if t < 0.47:
            return 0.0
        if t < 0.53:                              # re-acquire flicker
            return 1.0 if FLICK[f] < (t - 0.47) / 0.06 else 0.1
        return 1.0

    def set_packets(f):
        start, t = set_frame(f)
        lvl = beam_level(t, f)
        start_pk.hide_render = True
        beam.hide_render = lvl <= 0.0
        BEAM_STR.default_value *= lvl
        cm = cam.matrix_world.to_3x3()
        right, up, back = cm.col[0].normalized(), cm.col[1].normalized(), cm.col[2].normalized()
        arrivals = []
        for i, ((o, e), ta, (t0, t1)) in enumerate(zip(SP, APPEAR, SEND)):
            slot = start + back * 25.0 + right * 11.0 + up * (4.5 - 3.0 * i)
            if t < ta:
                o.hide_render = True
                continue
            o.hide_render = False
            pop = smooth((t - ta) / 0.05)
            k = 0.2 + 0.8 * pop + 0.25 * math.sin(math.pi * pop)
            if t < t0:
                o.location = slot
                o.scale = (k, k, k)
            elif t <= t1:
                x = (t - t0) / (t1 - t0)
                if x < 0.12:
                    o.location = slot.lerp(start, smooth(x / 0.12))
                else:
                    o.location = start.lerp(GROUND_PT, smooth((x - 0.12) / 0.88) ** 1.5)
                o.scale = (1, 1, 1)
            else:
                o.hide_render = True
                arrivals.append(t - t1)
        ro, re_ = REPLY
        if REPLY_T[0] <= t <= REPLY_T[1]:
            x = (t - REPLY_T[0]) / (REPLY_T[1] - REPLY_T[0])
            ro.hide_render = False
            ro.location = GROUND_PT.lerp(start, 1 - (1 - smooth(x)) ** 1.5)
        else:
            ro.hide_render = True
        flash = sum(30.0 * math.exp(-a / 0.03) for a in arrivals if a < 0.12)
        GROUND_EM.inputs[1].default_value = 5.0 + flash


# ----------------------------------------------------------------------------- render
if os.environ.get("DEBUG_BEAM"):
    set_packets(80)
    if os.environ.get("DEBUG_BEAM") == "2":
        mm, _ = emission_mat("dbg", (1, 0, 0), 5.0)
        beam.data.materials[0] = mm
    print("BEAM", beam.location, beam.scale, beam.rotation_euler, beam.hide_render, beam.data.vertices[0].co, beam.data.vertices[-1].co, len(beam.data.vertices))
if os.environ.get("NO_ATM"):
    atm.hide_render = True
frames = [int(x) for x in A.frames.split(",")] if A.frames else list(range(1, N + 1))
for f in frames:
    sc.frame_set(f)
    set_packets(f)
    sc.render.filepath = os.path.join(A.out, f"f_{f:04d}.png")
    bpy.ops.render.render(write_still=True)
print("DONE", len(frames))
