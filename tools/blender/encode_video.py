"""Encode a PNG frame sequence to web video with Blender's built-in FFmpeg (no system ffmpeg needed).

  Blender -b -P tools/blender/encode_video.py -- --frames <dir> --out hero-1080.mp4 --width 1920 --height 1080 [--crf 23] [--codec h264|vp9] [--fps 24]
  Blender -b -P tools/blender/encode_video.py -- --frames <dir> --poster hero-poster.jpg --width 1920 --height 1080 [--quality 82]

MP4 output is rewritten with the moov atom first ("faststart") so browsers can start playback immediately.
"""
import bpy, os, sys, glob, struct, argparse

argv = sys.argv[sys.argv.index("--") + 1:]
ap = argparse.ArgumentParser()
ap.add_argument("--frames", required=True)
ap.add_argument("--out")
ap.add_argument("--poster")
ap.add_argument("--width", type=int, default=1920)
ap.add_argument("--height", type=int, default=1080)
ap.add_argument("--crf", type=int, default=23)
ap.add_argument("--codec", default="h264")
ap.add_argument("--fps", type=int, default=24)
ap.add_argument("--quality", type=int, default=82)
A = ap.parse_args(argv)

files = sorted(glob.glob(os.path.join(A.frames, "*.png")))
assert files, "no frames"


def faststart(path):
    data = open(path, "rb").read()
    boxes, i = [], 0
    while i < len(data):
        size, typ = struct.unpack(">I4s", data[i:i + 8])
        hdr = 8
        if size == 1:
            size = struct.unpack(">Q", data[i + 8:i + 16])[0]
            hdr = 16
        elif size == 0:
            size = len(data) - i
        boxes.append([typ, i, size])
        i += size
    order = [b[0] for b in boxes]
    if b"moov" not in order or b"mdat" not in order or order.index(b"moov") < order.index(b"mdat"):
        return False
    moov = next(b for b in boxes if b[0] == b"moov")
    mv = bytearray(data[moov[1]:moov[1] + moov[2]])
    shift = len(mv)

    def patch(buf, start, end):
        j = start
        while j < end:
            sz, ty = struct.unpack(">I4s", buf[j:j + 8])
            if sz < 8:
                break
            if ty in (b"trak", b"mdia", b"minf", b"stbl", b"edts"):
                patch(buf, j + 8, j + sz)
            elif ty == b"stco":
                n = struct.unpack(">I", buf[j + 12:j + 16])[0]
                for k in range(n):
                    p = j + 16 + 4 * k
                    struct.pack_into(">I", buf, p, struct.unpack(">I", buf[p:p + 4])[0] + shift)
            elif ty == b"co64":
                n = struct.unpack(">I", buf[j + 12:j + 16])[0]
                for k in range(n):
                    p = j + 16 + 8 * k
                    struct.pack_into(">Q", buf, p, struct.unpack(">Q", buf[p:p + 8])[0] + shift)
            j += sz

    patch(mv, 8, len(mv))
    out = bytearray()
    for typ, off, size in boxes:
        if typ == b"moov":
            continue
        if typ == b"mdat":
            out += mv
        out += data[off:off + size]
    open(path, "wb").write(out)
    return True


sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = A.width, A.height
sc.render.resolution_percentage = 100
sc.render.fps = A.fps
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
se = sc.sequence_editor_create()
strips = se.strips if hasattr(se, "strips") else se.sequences
st = strips.new_image("frames", files[0], 1, 1, fit_method="FIT")
for f in files[1:]:
    st.elements.append(os.path.basename(f))
sc.frame_start, sc.frame_end = 1, len(files)
r = sc.render
r.use_sequencer = True
r.use_compositing = False

if A.poster:
    sc.frame_end = 1
    ims = r.image_settings
    ims.file_format = "JPEG"
    ims.quality = A.quality
    ims.color_mode = "RGB"
    r.filepath = A.poster
    sc.frame_set(1)
    bpy.ops.render.render(write_still=True)
    print("POSTER", A.poster, os.path.getsize(A.poster))
    sys.exit(0)

ims = r.image_settings
try:
    ims.media_type = "VIDEO"
except Exception:
    pass
ims.file_format = "FFMPEG"
ims.color_mode = "RGB"
ff = r.ffmpeg
if A.codec == "vp9":
    ff.format, ff.codec = "WEBM", "WEBM"
else:
    ff.format, ff.codec = "MPEG4", "H264"
ff.constant_rate_factor = "CUSTOM"
ff.custom_constant_rate_factor = A.crf
ff.ffmpeg_preset = "BEST"
ff.gopsize = A.fps * 2
ff.audio_codec = "NONE"
r.use_file_extension = False
r.filepath = A.out
bpy.ops.render.render(animation=True)
if A.codec != "vp9":
    print("faststart:", faststart(A.out))
print("VIDEO", A.out, os.path.getsize(A.out))
