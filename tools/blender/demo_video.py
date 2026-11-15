"""Cut the 30-second submission video (NASA Space Apps: demo video of at most 30 s) in Blender's sequencer.

  GPU=1 node tools/record/record_console.mjs /tmp/rec-cut cut       # 1. record the live console
  Blender -b -P tools/blender/demo_video.py -- --rec /tmp/rec-cut [--out ...] [--stills DIR]

Sources: the Blender hero and story films (frontend/public/media), a real screen recording of the live
console (Cut link -> on-board alert -> restore, from record_console.mjs) and a real screenshot of the
May 2024 NASA DONKI replay (docs/media/shots). 1920x1080, 24 fps, 29 s, no sound.
--stills renders a few check frames instead.
"""
import bpy, os, re, sys, json, argparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default=os.path.join(ROOT, "frontend/public/media/aegis-medlink-demo-30s.mp4"))
ap.add_argument("--stills")
ap.add_argument("--rec", required=True, help="frames folder written by tools/record/record_console.mjs ... cut")
A = ap.parse_args(argv)

FPS = 24
MEDIA = os.path.join(ROOT, "frontend/public/media")
SHOTS = os.path.join(ROOT, "docs/media/shots")
FONT = next((p for p in (os.path.expanduser("~/Library/Fonts/Inter[opsz,wght].ttf"), "/System/Library/Fonts/SFNS.ttf") if os.path.exists(p)), None)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, 100
sc.render.fps = FPS
sc.view_settings.view_transform = "Standard"
se = sc.sequence_editor_create()
strips = se.strips if hasattr(se, "strips") else se.sequences
font = bpy.data.fonts.load(FONT) if FONT else None

f = lambda s: int(round(s * FPS)) + 1          # seconds -> frame


def effect(name, kind, ch, start, end):
    try:
        return strips.new_effect(name=name, type=kind, channel=ch, frame_start=start, length=end - start)
    except TypeError:
        return strips.new_effect(name=name, type=kind, channel=ch, frame_start=start, frame_end=end)


def fade(strip, start, end, n=8, top=1.0):
    """Fade in over n frames from start, out over n frames before end."""
    for fr, v in ((start, 0.0), (start + n, top), (end - n, top), (end, 0.0)):
        strip.blend_alpha = v
        strip.keyframe_insert("blend_alpha", frame=fr)


def movie(name, path, ch, start, end, offset=0, scale=1.0):
    m = strips.new_movie(name=name, filepath=path, channel=ch, frame_start=start - offset)
    if offset:
        m.frame_offset_start = offset
    m.frame_final_end = end if hasattr(m, "frame_final_end") else end
    m.transform.scale_x = m.transform.scale_y = scale
    m.blend_type = "ALPHA_OVER"
    return m


def still(name, path, ch, start, end, s0, s1, dy):
    im = strips.new_image(name=name, filepath=path, channel=ch, frame_start=start)
    im.frame_final_end = end
    im.blend_type = "ALPHA_OVER"
    im.transform.offset_y = dy
    for fr, v in ((start, s0), (end, s1)):                      # slow push-in
        im.transform.scale_x = im.transform.scale_y = v
        im.transform.keyframe_insert("scale_x", frame=fr)
        im.transform.keyframe_insert("scale_y", frame=fr)
    fade(im, start, end)
    return im


def text(body, ch, start, end, size, y, color=(1, 1, 1, 1), box=False, x=0.5):
    t = effect("txt", "TEXT", ch, start, end)
    t.text = body
    if font:
        t.font = font
    t.font_size = size
    t.color = color
    t.location = (x, y)
    for attr, val in (("anchor_x", "CENTER"), ("anchor_y", "CENTER"), ("alignment_x", "CENTER"), ("align_x", "CENTER"), ("align_y", "CENTER")):
        if hasattr(t, attr):
            try: setattr(t, attr, val)
            except Exception: pass
    t.wrap_width = 0.86
    t.use_shadow = False
    if box:
        t.use_box = True
        t.box_color = (0.02, 0.025, 0.03, 0.78)
        t.box_margin = 0.012
        if hasattr(t, "box_roundness"):
            t.box_roundness = 0.35
    t.blend_type = "ALPHA_OVER"
    fade(t, start, end, n=6)
    return t


def dim(ch, start, end, alpha):
    c = effect("dim", "COLOR", ch, start, end)
    c.color = (0, 0, 0)
    c.blend_type = "ALPHA_OVER"
    c.blend_alpha = alpha
    return c


WHITE, SOFT, FAINT = (1, 1, 1, 1), (0.82, 0.85, 0.88, 1), (0.6, 0.64, 0.68, 1)
END = f(29.0)
base = effect("black", "COLOR", 1, 1, END)
base.color = (0, 0, 0)

# A. title over the hero film (0 - 3 s)
a0, a1 = f(0), f(3.0)
fade(movie("hero", os.path.join(MEDIA, "hero-1080.mp4"), 2, a0, a1), a0, a1, n=10)
dim(3, a0, a1, 0.3)
text("AEGIS-MEDLINK", 4, a0 + 4, a1, 118, 0.76)
text("Astronaut health monitoring that keeps working when Earth goes silent", 5, a0 + 10, a1, 36, 0.64, SOFT)
text("NASA Space Apps 2026  ·  Create Health Monitoring Software for Astronauts on Space Missions", 6, a0 + 16, a1, 26, 0.57, FAINT)

# B. the hook, over the story film (3 - 7.5 s)
b0, b1 = a1, f(7.5)
fade(movie("story", os.path.join(MEDIA, "story-media-720.mp4"), 2, b0, b1, scale=1.5), b0, b1, n=6)
bm = b0 + (b1 - b0) // 2
text("Day 182. Aylin's heart rate is climbing at rest.", 4, b0, bm, 44, 0.085, WHITE, box=True)
text("Earth is 14 light-minutes away. Around solar conjunction, out of reach for two weeks.", 5, bm, b1, 38, 0.085, WHITE, box=True)

# C. a real screen recording of the live console (7.5 - 20.5 s): Cut link -> on-board alert -> restore
c0, c1 = b1, f(20.5)
REC = os.path.abspath(A.rec)
frames = json.load(open(os.path.join(REC, "frames.json")))
REC_FROM = 0.5                                              # seconds into the recording
LAG = 1.0                                                   # the console polls once a second: captions follow what is on screen
SPEED = (frames[-1]["t"] - REC_FROM) / ((c1 - c0) / FPS)    # fit the recording into the segment
pick = []                                                   # one recorded frame per output frame
for k in range(c1 - c0):
    t = REC_FROM + k / FPS * SPEED
    pick.append(max((x for x in frames if x["t"] <= t), key=lambda x: x["t"], default=frames[0])["file"])
rec = strips.new_image(name="rec", filepath=os.path.join(REC, pick[0]), channel=2, frame_start=c0)
for fn in pick[1:]:
    rec.elements.append(fn)
rec.frame_final_end = c1
rec.blend_type = "ALPHA_OVER"
rec.transform.scale_x = rec.transform.scale_y = 0.855
rec.transform.offset_y = 62
fade(rec, c0, c1, n=6)
def at(phase):                                              # output frame where a recorded phase starts
    t = next(x["t"] for x in frames if x["phase"] == phase) + LAG
    return c0 + int(round((t - REC_FROM) / SPEED * FPS))
CAPS = [(c0, "The live console, running. One click cuts the link to Earth."),
        (at("cut"), "Link cut: Earth goes silent."),
        (at("alert"), "AEGIS still raises the alert on board, without Earth. The PulseBrief waits."),
        (at("restore"), "Link back: the headline crosses first over real BPv7, then the evidence.")]
for i, (s0, body) in enumerate(CAPS):
    s1 = CAPS[i + 1][0] if i + 1 < len(CAPS) else c1
    text(body, 4 + i, s0, s1, 36, 0.062, WHITE)
text(f"Screen recording of the live console, {SPEED:.1f}x speed  ·  crew data simulated", 8, c0, c1, 22, 0.022, FAINT)

# D. real NASA data at work (20.5 - 24.5 s)
d0, d1 = c1, f(24.5)
still("donki", os.path.join(SHOTS, "console-donki-replay.jpg"), 2, d0, d1, 0.845, 0.865, 62)
text("Real NASA DONKI data: the May 2024 solar storm raises a real alert, with shelter steps.", 4, d0, d1, 36, 0.062, WHITE)
text("Replay of real NASA DONKI records  ·  crew data simulated", 5, d0, d1, 22, 0.022, FAINT)

# E. end card (24.5 - 29 s)
e0, e1 = d1, END
fade(movie("hero2", os.path.join(MEDIA, "hero-1080.mp4"), 2, e0, e1, offset=100), e0, e1, n=10)
dim(3, e0, e1, 0.6)
text("During the silence, the astronaut is never alone.", 4, e0 + 4, e1, 58, 0.83)
text("2.7 MB of raw readings sent as 21 KB of PulseBriefs  ·  0 events lost across blackouts", 5, e0 + 10, e1, 28, 0.72, SOFT)
text("The same design serves ships, research stations and remote clinics on Earth", 6, e0 + 10, e1, 28, 0.665, SOFT)
text("againstsilence.earth", 7, e0 + 16, e1, 46, 0.565)
text("Team Against the Silence  ·  NASA Space Apps Challenge 2026  ·  Sivas", 8, e0 + 16, e1, 26, 0.495, SOFT)

sc.frame_start, sc.frame_end = 1, END - 1

if A.stills:
    os.makedirs(A.stills, exist_ok=True)
    sc.render.image_settings.file_format = "JPEG"
    for s in (1.8, 4.0, 6.5, 9.0, 11.5, 15.0, 19.0, 22.0, 27.5):
        sc.frame_set(f(s))
        sc.render.filepath = os.path.join(A.stills, f"t{s:04.1f}.jpg")
        bpy.ops.render.render(write_still=True)
else:
    r = sc.render
    try: r.image_settings.media_type = "VIDEO"
    except Exception: pass
    r.image_settings.file_format = "FFMPEG"
    r.ffmpeg.format, r.ffmpeg.codec = "MPEG4", "H264"
    r.ffmpeg.constant_rate_factor = "HIGH"
    r.ffmpeg.ffmpeg_preset = "GOOD"
    r.ffmpeg.gopsize = FPS
    r.ffmpeg.audio_codec = "NONE"
    r.filepath = A.out
    bpy.ops.render.render(animation=True)
    # reuse the faststart rewrite from encode_video.py (moov atom first, so browsers start at once)
    src = open(os.path.join(os.path.dirname(__file__), "encode_video.py")).read()
    ns = {}
    exec("import struct\n" + re.search(r"def faststart\(path\):.*?return True\n", src, re.S).group(0), ns)
    out = A.out if os.path.exists(A.out) else next(p for p in (A.out + ".mp4", os.path.splitext(A.out)[0] + "0001-%04d.mp4" % (END - 1)) if os.path.exists(p))
    if out != A.out:
        os.replace(out, A.out)
    print("faststart:", ns["faststart"](A.out), A.out, os.path.getsize(A.out))
