"""Check a web video without ffprobe: MP4 box order (faststart), codec/profile, duration, and decode test frames with Blender.

  Blender -b -P tools/blender/verify_video.py -- <video> <png_out_prefix> [frame ...]
"""
import bpy, os, sys, struct

args = sys.argv[sys.argv.index("--") + 1:]
path, prefix = args[0], args[1]
frames = [int(x) for x in args[2:]] or [1]
data = open(path, "rb").read()

if path.endswith(".mp4"):
    i, top = 0, []
    while i < len(data):
        size, typ = struct.unpack(">I4s", data[i:i + 8])
        size = struct.unpack(">Q", data[i + 8:i + 16])[0] if size == 1 else (size or len(data) - i)
        top.append(typ.decode())
        i += size
    print("MP4 top-level boxes:", top, "(faststart)" if top.index("moov") < top.index("mdat") else "(moov at end!)")
    k = data.find(b"mvhd")
    ver = data[k + 4]
    ts, dur = (struct.unpack(">II", data[k + 16:k + 24]) if ver == 0 else struct.unpack(">IQ", data[k + 24:k + 36]))
    print("duration s:", dur / ts)
    k = data.find(b"avcC")
    if k > 0:
        ln = struct.unpack(">H", data[k + 10:k + 12])[0]
        rb, z = bytearray(), 0
        for byte in data[k + 12:k + 12 + ln]:            # SPS without emulation-prevention bytes
            if z >= 2 and byte == 3:
                z = 0
                continue
            rb.append(byte)
            z = z + 1 if byte == 0 else 0
        bits = "".join(f"{x:08b}" for x in rb[4:])
        pos = [0]

        def ue():
            n = 0
            while bits[pos[0]] == "0":
                n += 1
                pos[0] += 1
            pos[0] += 1
            v = int("1" + bits[pos[0]:pos[0] + n], 2) - 1 if n else 0
            pos[0] += n
            return v
        ue()
        cf = ue() if rb[1] >= 100 else 1
        if cf == 3:
            pos[0] += 1
        bd = ue() + 8 if rb[1] >= 100 else 8
        print("H.264 profile_idc", rb[1], "level", rb[3] / 10, "chroma_format_idc", cf, "(1 = yuv420p)", "bit depth", bd)
print("size bytes:", len(data))

sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 960, 540
se = sc.sequence_editor_create()
strips = se.strips if hasattr(se, "strips") else se.sequences
st = strips.new_movie("v", path, 1, 1, fit_method="FIT")
print("decoded frame count:", st.frame_final_duration, "size", st.elements[0].orig_width if st.elements else "")
sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "Standard"
sc.render.use_sequencer = True
sc.render.image_settings.file_format = "PNG"
for f in frames:
    sc.frame_set(f)
    sc.render.filepath = f"{prefix}_{f:04d}.png"
    bpy.ops.render.render(write_still=True)
print("OK")
