#!/usr/bin/env python3
"""2026 교육 마무리 릴스 (15초, 1080x1920) 빌드 스크립트."""
import os, subprocess, sys

S = os.path.dirname(os.path.abspath(__file__))
U = "/root/.claude/uploads/d8e5c14e-a2a0-5dd0-b801-cc5918a557fe"
F = f"{S}/fonts"
OUT = f"{S}/out"; os.makedirs(OUT, exist_ok=True)
TXT = f"{S}/txt"; os.makedirs(TXT, exist_ok=True)
FPS = 30
XF = 0.2  # crossfade length

BOLD = f"{F}/Pretendard-Bold.otf"
XBOLD = f"{F}/Pretendard-ExtraBold.otf"
MED = f"{F}/Pretendard-Medium.otf"
SERIF = f"{F}/cormorant-garamond-latin-600-normal.woff"
ITAL = f"{F}/cormorant-garamond-latin-400-italic.woff"
BEIGE = "0xE9D8C2"

TM = ("zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,"
      "tonemap=mobius:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
GRADE = ("eq=contrast=1.04:saturation=1.06:gamma=0.98,"
         "colorbalance=rs=0.025:gs=0.005:bs=-0.03:rm=0.02:bm=-0.025:rh=0.01:bh=-0.015,"
         "vignette=angle=PI/5")

_n = [0]
def tf(text):
    _n[0] += 1
    p = f"{TXT}/t{_n[0]}.txt"
    open(p, "w", encoding="utf-8").write(text)
    return p

def fade_alpha(a, b, fin=0.3, fout=0.25):
    return (f"if(lt(t,{a}),0,if(lt(t,{a+fin}),(t-{a})/{fin},"
            f"if(lt(t,{b-fout}),1,if(lt(t,{b}),({b}-t)/{fout},0))))")

def text(t, font, size, color, y, a, b, x="(w-text_w)/2", rise=24, shadow=True, extra=""):
    yexpr = f"{y}+{rise}*(1-min(1,max(0,(t-{a})/0.35)))"
    sh = ":shadowcolor=black@0.45:shadowx=0:shadowy=3" if shadow else ""
    return (f"drawtext=fontfile={font}:textfile={tf(t)}:fontsize={size}:fontcolor={color}"
            f":x={x}:y='{yexpr}':alpha='{fade_alpha(a, b)}'{sh}{extra}")

def caption(eyebrow, line, d, a=0.25):
    b = d - 0.05
    return ",".join([
        text(eyebrow, ITAL, 46, BEIGE, 1150, a, b),
        text(line, BOLD, 70, "white", 1215, a + 0.08, b),
    ])

def zoom(d, z0, z1, fx=0.5, fy=0.5):
    n = round(d * FPS)
    z = f"{z0}+({z1}-{z0})*on/{n}"
    return (f"scale=2160:3840:flags=lanczos,"
            f"zoompan=z='{z}':d=1:s=1080x1920:fps={FPS}"
            f":x='max(0,min(iw-iw/zoom,iw*{fx}-iw/zoom/2))'"
            f":y='max(0,min(ih-ih/zoom,ih*{fy}-ih/zoom/2))'")

GRAD = f"{S}/grad.png"
def make_grad():
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=black:1080x1920,format=rgba",
                    "-vf", "geq=r=0:g=0:b=0:a='120*exp(-pow((Y-1240)/300,2))'",
                    "-frames:v", "1", GRAD], check=True)

# (source, start, duration, zoom from, zoom to, focus x, focus y, eyebrow, caption)
SEGS = [
    ("7dcba8a4-IMG_5771.MOV", 0.0, 2.2, 1.14, 1.02, 0.62, 0.50, "Master Education 2026", "NOW BARRE 지도자 과정"),
    ("e3530b3c-IMG_5708.MOV", 0.0, 2.1, 1.00, 1.08, 0.40, 0.45, "hands-on", "한 명 한 명, 직접 잡아주고"),
    ("3a96f4b4-IMG_5707.MOV", 6.8, 2.0, 1.06, 1.00, 0.12, 0.55, "every detail", "디테일 하나까지 짚어주고"),
    ("86ec96a0-IMG_5830.MOV", 1.0, 1.8, 1.00, 1.07, 0.42, 0.40, "lead by example", "먼저 몸으로 보여주는"),
    ("6dc259bc-IMG_5848.MOV", 6.8, 2.0, 1.10, 1.02, 0.55, 0.45, "real practice", "실전 중심 바레 교육"),
    ("ade5146a-IMG_5851.MOV", 7.0, 2.0, 1.28, 1.20, 0.80, 0.52, "2026 complete", "올해 교육, 마무리했습니다"),
]
TRANS = ["fadewhite", "fadewhite", "fadewhite", "fadewhite", "fadewhite", "fade"]
PHOTO_D = 4.1

def run(args):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + args)
    if r.returncode: sys.exit(r.returncode)

def render_seg(i, seg):
    src, ss, d, z0, z1, fx, fy, eb, cap = seg
    vf = [TM, GRADE, zoom(d, z0, z1, fx, fy)]
    chain = ",".join(vf[:3])
    overlays = caption(eb, cap, d)
    if i == 1:  # 이름 카드
        overlays += "," + ",".join([
            f"drawbox=x=80:y=250:w=4:h=118:color={BEIGE}:t=fill:enable='between(t,0.3,{d})'",
            text("전민희", XBOLD, 58, "white", 244, 0.3, d - 0.05, x="104", rise=0),
            text("NOW BARRE 대표원장 · 마스터강사", MED, 32, BEIGE, 322, 0.42, d - 0.05, x="106", rise=0),
        ])
    fc = (f"[0:v]trim=start=0:duration={d},setpts=PTS-STARTPTS,{chain}[v];"
          f"[1:v]format=rgba[g];[v][g]overlay=0:0,{overlays},format=yuv420p[o]")
    run(["-ss", str(ss), "-t", str(d + 0.2), "-i", f"{U}/{src}", "-loop", "1", "-i", GRAD,
         "-filter_complex", fc, "-map", "[o]", "-t", str(d), "-r", str(FPS),
         "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p",
         "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
         f"{OUT}/seg{i}.mp4"])

def render_photo():
    d = PHOTO_D
    n = round(d * FPS)
    img = f"{U}/7e3f42ec-image.jpg"
    t1 = 2.0  # 연말행사 → 엔딩 전환 시점
    # 1500x2000 → 높이 3840 기준 2880x3840, 가로 중앙보다 약간 왼쪽(인물 쪽)으로 크롭
    base = (f"scale=2880:3840:flags=lanczos,crop=2160:3840:300:0,"
            f"zoompan=z='1.0+0.09*on/{n}':d=1:s=1080x1920:fps={FPS}"
            f":x='iw/2-iw/zoom/2':y='ih*0.42-ih/zoom/2',{GRADE}")
    end = 0.6
    a2 = t1 + 0.35
    overlays = ",".join([
        caption("December", "12월, 우리 강사님들과 함께하는 연말", t1 + 0.05, a=0.2),
        text("thank you, 2026", ITAL, 48, BEIGE, 700, a2, 99),
        text("더 단단하게 준비해서", MED, 50, "white", 790, a2 + 0.12, 99),
        text("2027", SERIF, 210, "white", 860, a2 + 0.3, 99, rise=30),
        text("15기로 찾아뵙겠습니다", XBOLD, 76, "white", 1100, a2 + 0.45, 99),
        f"drawbox=x=500:y=1240:w=80:h=2:color={BEIGE}@0.9:t=fill:enable='gte(t,{a2+0.6})'",
        text("NOW BARRE", SERIF, 56, "white", 1275, a2 + 0.65, 99, rise=0),
        text("Master Educator  전민희", MED, 30, BEIGE, 1350, a2 + 0.75, 99, rise=0),
    ])
    fc = (f"[0:v]{base},format=yuv420p,split[a][b];"
          f"[b]gblur=sigma=18,format=yuva420p,fade=in:st={t1-0.1}:d={end}:alpha=1[bl];"
          f"[a][bl]overlay=0:0[m];"
          f"color=black:1080x1920:r={FPS},format=yuva420p,colorchannelmixer=aa=0.5,"
          f"fade=in:st={t1-0.1}:d={end}:alpha=1[dk];"
          f"[m][dk]overlay=0:0:shortest=1[m2];"
          f"[2:v]format=rgba,fade=out:st={t1-0.2}:d=0.3:alpha=1[g];"
          f"[m2][g]overlay=0:0,{overlays},format=yuv420p[o]")
    run(["-loop", "1", "-framerate", str(FPS), "-t", str(d), "-i", img,
         "-f", "lavfi", "-i", "anullsrc", "-loop", "1", "-framerate", str(FPS), "-t", str(d), "-i", GRAD,
         "-filter_complex", fc, "-map", "[o]", "-t", str(d), "-r", str(FPS),
         "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p",
         f"{OUT}/seg_photo.mp4"])

def assemble():
    files = [f"{OUT}/seg{i}.mp4" for i in range(len(SEGS))] + [f"{OUT}/seg_photo.mp4"]
    durs = [s[2] for s in SEGS] + [PHOTO_D]
    args = []
    for f in files: args += ["-i", f]
    parts, prev, acc = [], "[0:v]", durs[0]
    for k in range(1, len(files)):
        off = acc - XF
        lab = f"[x{k}]"
        parts.append(f"{prev}[{k}:v]xfade=transition={TRANS[k-1]}:duration={XF}:offset={off:.3f}{lab}")
        prev, acc = lab, acc + durs[k] - XF
    total = acc
    fc = ";".join(parts) + f";{prev}format=yuv420p[v]"
    out = f"{S}/NOWBARRE_2026_교육마무리_15기예고.mp4"
    run(args + ["-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
                "-filter_complex", fc, "-map", "[v]", "-map", f"{len(files)}:a",
                "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                "-profile:v", "high", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out])
    print("total", round(total, 2), out)

if __name__ == "__main__":
    make_grad()
    only = sys.argv[1:]
    for i, s in enumerate(SEGS):
        if not only or str(i) in only: render_seg(i, s)
    if not only or "p" in only: render_photo()
    assemble()
