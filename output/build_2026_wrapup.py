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
POINT = "0xFFB15C"  # 포인트 컬러 (웜 앰버)

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

from PIL import ImageFont

def rich(line, size, y, a, b, base=BOLD, hi=XBOLD, rise=24):
    """[대괄호] 안의 단어를 포인트 컬러 + 더 굵게 그려서 가운데 정렬."""
    import re
    parts = [(m, i % 2 == 1) for i, m in enumerate(re.split(r"\[|\]", line)) if m]
    fonts = {False: ImageFont.truetype(base, size), True: ImageFont.truetype(hi, size)}
    widths = [fonts[h].getlength(t) for t, h in parts]
    x = (1080 - sum(widths)) / 2
    out = []
    for (t, h), w in zip(parts, widths):
        out.append(text(t, hi if h else base, size, POINT if h else "white", y, a, b,
                        x=f"{x:.1f}", rise=rise))
        x += w
    return ",".join(out)

def caption(eyebrow, line, d, a=0.25, hold=False):
    b = 99 if hold else d - 0.05
    return ",".join([
        text(eyebrow, ITAL, 46, BEIGE, 1150, a, b),
        rich(line, 70, 1215, a + 0.08, b),
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

# ---- 130 BPM 비트 그리드: 모든 컷이 박자 위에 떨어지도록 프레임 단위로 계산 ----
BPM = 130
BEAT = 60 / BPM
TOTAL_FRAMES = 15 * FPS
def bf(beat): return round(beat * BEAT * FPS)

# (source, start, beats, zoom from, zoom to, focus x, focus y, eyebrow, caption, title mode)
# title mode: "in" = 자막 등장 후 다음 컷까지 유지, "keep" = 이미 떠 있는 상태로 시작
SEGS = [
    ("86ec96a0-IMG_5830.MOV", 1.4, 2, 1.00, 1.10, 0.42, 0.40, "Master Education 2026", "[NOW BARRE] 지도자 과정", "in"),
    ("7dcba8a4-IMG_5771.MOV", 0.3, 2, 1.12, 1.04, 0.62, 0.50, "Master Education 2026", "[NOW BARRE] 지도자 과정", "keep"),
    ("e3530b3c-IMG_5708.MOV", 0.0, 4, 1.00, 1.08, 0.40, 0.45, "hands-on", "한 명 한 명, [직접] 잡아주고", None),
    ("3a96f4b4-IMG_5707.MOV", 6.8, 4, 1.06, 1.00, 0.12, 0.55, "every detail", "[디테일] 하나까지 짚어주고", None),
    ("410f3d4d-IMG_5821.MOV", 0.0, 4, 1.00, 1.06, 0.50, 0.40, "lead by example", "먼저 [몸으로] 보여주는", None),
    ("6dc259bc-IMG_5848.MOV", 6.8, 4, 1.10, 1.02, 0.55, 0.45, "real practice", "[실전 중심] 바레 교육", None),
    ("ade5146a-IMG_5851.MOV", 7.0, 4, 1.28, 1.20, 0.80, 0.52, "2026 complete", "올해 교육, [마무리]했습니다", None),
]
# 박자 시작점 → 프레임 수
_starts = [0]
for sg in SEGS: _starts.append(_starts[-1] + sg[2])
SEG_FRAMES = [bf(_starts[k + 1]) - bf(_starts[k]) for k in range(len(SEGS))]
PHOTO_BEAT0 = _starts[-1]          # 사진 시작 박 (24)
END_BEAT = PHOTO_BEAT0 + 4         # 엔딩 카드 시작 박 (28)
PHOTO_FRAMES = TOTAL_FRAMES - bf(PHOTO_BEAT0)
PHOTO_D = PHOTO_FRAMES / FPS
FLASH = "fade=in:st=0:d=0.12:color=white"  # 컷마다 짧은 화이트 플래시

def run(args):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + args)
    if r.returncode: sys.exit(r.returncode)

def render_seg(i, seg):
    src, ss, _, z0, z1, fx, fy, eb, cap, mode = seg
    d = SEG_FRAMES[i] / FPS
    vf = [TM, GRADE, zoom(d, z0, z1, fx, fy)]
    chain = ",".join(vf[:3])
    if mode == "in":
        overlays = caption(eb, cap, d, a=0.12, hold=True)
    elif mode == "keep":
        overlays = caption(eb, cap, d, a=-5)
    else:
        overlays = caption(eb, cap, d)
    if i > 0:  # 첫 프레임은 하얗게 시작하지 않도록
        overlays += "," + FLASH
    if i == 2:  # 이름 카드
        overlays += "," + ",".join([
            f"drawbox=x=80:y=250:w=4:h=118:color={BEIGE}:t=fill:enable='between(t,0.3,{d})'",
            text("전민희", XBOLD, 58, "white", 244, 0.3, d - 0.05, x="104", rise=0),
            text("NOW BARRE 대표원장 · 마스터강사", MED, 32, BEIGE, 322, 0.42, d - 0.05, x="106", rise=0),
        ])
    fc = (f"[0:v]trim=start=0:duration={d},setpts=PTS-STARTPTS,{chain}[v];"
          f"[1:v]format=rgba[g];[v][g]overlay=0:0,{overlays},format=yuv420p[o]")
    run(["-ss", str(ss), "-t", str(d + 0.2), "-i", f"{U}/{src}", "-loop", "1", "-i", GRAD,
         "-filter_complex", fc, "-map", "[o]", "-frames:v", str(SEG_FRAMES[i]), "-r", str(FPS),
         "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p",
         "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
         f"{OUT}/seg{i}.mp4"])

def render_photo():
    d = PHOTO_D
    n = round(d * FPS)
    img = f"{U}/7e3f42ec-image.jpg"
    t1 = (bf(END_BEAT) - bf(PHOTO_BEAT0)) / FPS  # 연말파티 → 엔딩 전환 (정확히 28번째 박)
    # 1500x2000 → 높이 3840 기준 2880x3840, 가로 중앙보다 약간 왼쪽(인물 쪽)으로 크롭
    base = (f"scale=2880:3840:flags=lanczos,crop=2160:3840:300:0,"
            f"zoompan=z='1.0+0.09*on/{n}':d=1:s=1080x1920:fps={FPS}"
            f":x='iw/2-iw/zoom/2':y='ih*0.42-ih/zoom/2',{GRADE}")
    end = 0.3
    a2 = t1 + 0.03
    overlays = ",".join([
        caption("December", "12월은 강사님들과 [연말 파티]로!", t1, a=0.2),
        text("thank you, 2026", ITAL, 48, BEIGE, 700, a2, 99),
        text("더 단단하게 준비해서", MED, 50, "white", 790, a2 + 0.08, 99),
        text("2027", SERIF, 210, POINT, 860, t1 + BEAT, 99, rise=30),          # 29번째 박
        text("15기로 찾아뵙겠습니다", XBOLD, 76, "white", 1100, t1 + 2 * BEAT, 99),  # 30번째 박
        f"drawbox=x=500:y=1240:w=80:h=2:color={BEIGE}@0.9:t=fill:enable='gte(t,{t1 + 2.5 * BEAT})'",
        text("NOW BARRE", SERIF, 56, POINT, 1275, t1 + 2.5 * BEAT, 99, rise=0),
        text("Master Educator  전민희", MED, 30, BEIGE, 1350, t1 + 2.7 * BEAT, 99, rise=0),
        FLASH,
        f"fade=in:st={t1}:d=0.1:color=white",
    ])
    fc = (f"[0:v]{base},format=yuv420p,split[a][b];"
          f"[b]gblur=sigma=18,format=yuva420p,fade=in:st={t1-0.02}:d={end}:alpha=1[bl];"
          f"[a][bl]overlay=0:0[m];"
          f"color=black:1080x1920:r={FPS},format=yuva420p,colorchannelmixer=aa=0.5,"
          f"fade=in:st={t1-0.02}:d={end}:alpha=1[dk];"
          f"[m][dk]overlay=0:0:shortest=1[m2];"
          f"[2:v]format=rgba,fade=out:st={t1-0.05}:d=0.2:alpha=1[g];"
          f"[m2][g]overlay=0:0,{overlays},format=yuv420p[o]")
    run(["-loop", "1", "-framerate", str(FPS), "-t", str(d), "-i", img,
         "-f", "lavfi", "-i", "anullsrc", "-loop", "1", "-framerate", str(FPS), "-t", str(d), "-i", GRAD,
         "-filter_complex", fc, "-map", "[o]", "-frames:v", str(PHOTO_FRAMES), "-r", str(FPS),
         "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p",
         f"{OUT}/seg_photo.mp4"])

MUSIC = f"{S}/music.wav"

def assemble():
    files = [f"{OUT}/seg{i}.mp4" for i in range(len(SEGS))] + [f"{OUT}/seg_photo.mp4"]
    args = []
    for f in files: args += ["-i", f]
    n = len(files)
    fc = "".join(f"[{k}:v]" for k in range(n)) + f"concat=n={n}:v=1:a=0,format=yuv420p[v]"
    out = f"{S}/NOWBARRE_2026_교육마무리_15기예고.mp4"
    run(args + ["-i", MUSIC,
                "-filter_complex", fc, "-map", "[v]", "-map", f"{n}:a",
                "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                "-profile:v", "high", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                "-c:a", "aac", "-b:a", "192k", "-frames:v", str(TOTAL_FRAMES), "-t", "15", "-movflags", "+faststart", out])
    cuts = [round(bf(b) / FPS, 3) for b in _starts] + [round(bf(END_BEAT) / FPS, 3)]
    print("cuts(s):", cuts, "->", out)

if __name__ == "__main__":
    make_grad()
    only = sys.argv[1:]
    for i, s in enumerate(SEGS):
        if not only or str(i) in only: render_seg(i, s)
    if not only or "p" in only: render_photo()
    assemble()
