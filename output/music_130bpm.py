#!/usr/bin/env python3
"""130 BPM 오리지널 하우스 비트 (15초) — numpy 로 직접 합성. 저작권 걱정 없음."""
import numpy as np, wave, sys

SR = 48000
BPM = 130
B = 60 / BPM
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
out_path = sys.argv[1] if len(sys.argv) > 1 else "music.wav"

def t_(sec): return np.arange(int(sec * SR)) / SR

def add(buf, sig, at, gain=1.0):
    i = int(round(at * SR))
    if i >= len(buf): return
    sig = sig[: len(buf) - i]
    buf[i:i + len(sig)] += sig * gain

def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X * g, len(x))

def midi(n): return 440 * 2 ** ((n - 69) / 12)

def saw(freq, sec, detune=(0.0,)):
    t = t_(sec); s = 0
    for d in detune:
        f = freq * (1 + d)
        s = s + 2 * ((t * f + rng.random()) % 1) - 1
    return s / len(detune)

# ---------- drums ----------
def kick():
    t = t_(0.42)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    s[:120] += np.linspace(0.6, 0, 120) * rng.standard_normal(120) * 0.5  # click
    return np.tanh(s * 1.6)

def clap():
    t = t_(0.25); n = rng.standard_normal(len(t))
    env = np.zeros_like(t)
    for k, o in enumerate([0, 0.011, 0.022]):
        env += (t >= o) * np.exp(-(t - o) * (180 if k < 2 else 22)) * (t >= o)
    return fft_filter(n * env, lo=900, hi=7000)

def hat(open_=False):
    t = t_(0.18 if open_ else 0.05)
    n = rng.standard_normal(len(t)) * np.exp(-t * (16 if open_ else 90))
    return fft_filter(n, lo=7000)

def crash():
    t = t_(1.6)
    return fft_filter(rng.standard_normal(len(t)) * np.exp(-t * 2.4), lo=3500)

drums = np.zeros(N)
K, C, HC, HO, CR = kick(), clap(), hat(), hat(True), crash()
total_beats = int(DUR / B) + 1
for b in range(total_beats):
    tb = b * B
    if tb >= DUR: break
    if b < 32:
        add(drums, K, tb, 1.0)
        if b % 2 == 1: add(drums, C, tb, 0.55)
        add(drums, HO, tb + B / 2, 0.22)
        for s in (0.25, 0.75):
            add(drums, HC, tb + B * s, 0.12)
    # 엔딩 직전 스네어 롤 (beat 26~28)
    if 26 <= b < 28:
        for s in range(4):
            add(drums, C, tb + B * s / 4, 0.25 + 0.1 * (b - 26) + 0.05 * s)
add(drums, CR, 0.0, 0.45)          # 훅: 첫 박 크래시
add(drums, CR, 28 * B, 0.5)        # 엔딩 카드 진입
add(drums, K, 32 * B, 1.0)         # 마지막 한 방
add(drums, CR, 32 * B, 0.45)

# ---------- sidechain envelope ----------
side = np.ones(N)
for b in range(33):
    i = int(b * B * SR); L = int(0.28 * SR)
    seg = 1 - 0.75 * np.exp(-np.arange(L) / SR * 14)
    side[i:i + L] = np.minimum(side[i:i + L], seg[: max(0, min(L, N - i))])

# ---------- harmony: Fmaj7 - G - Em7 - Am (bar 단위) ----------
prog = [
    [53, 57, 60, 64],  # Fmaj7
    [55, 59, 62, 67],  # G
    [52, 55, 59, 62],  # Em7
    [57, 60, 64, 69],  # Am
]
roots = [41, 43, 40, 45]
BAR = 4 * B

pad = np.zeros(N); bass = np.zeros(N); pluck = np.zeros(N)
for bar in range(8):
    tb = bar * BAR
    ch = prog[bar % 4]
    # pad
    seg = sum(saw(midi(n), BAR + 0.05, (-0.006, 0.0, 0.007)) for n in ch) / 4
    env = np.minimum(1, t_(BAR + 0.05) / 0.02)
    add(pad, seg * env, tb, 1.0)
    # bass: 오프비트 8분
    for k in range(4):
        L = B / 2 * 0.9
        f = midi(roots[bar % 4])
        tt = t_(L)
        s = (np.sin(2 * np.pi * f * tt) + 0.5 * saw(f, L)) * np.exp(-tt * 3) * np.minimum(1, tt / 0.004)
        add(bass, s, tb + k * B + B / 2)
    # pluck arp: 16분 아르페지오
    order = [0, 1, 2, 3, 2, 1, 3, 2]
    for k in range(16):
        n = ch[order[k % 8]] + 12
        L = 0.18; tt = t_(L)
        f = midi(n)
        s = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.15 * saw(f, L)) * np.exp(-tt * 22)
        add(pluck, s, tb + k * B / 4, 0.9 if k % 4 == 0 else 0.6)

# 마지막 코드 히트 (Fmaj7 add9)
L = DUR - 32 * B
hit = sum(saw(midi(n), L, (-0.006, 0.006)) for n in [53, 57, 60, 64, 67, 72]) / 6
hit *= np.exp(-t_(L) * 2.2)
add(pad, hit, 32 * B, 1.6)
add(bass, np.sin(2 * np.pi * midi(29) * t_(L)) * np.exp(-t_(L) * 3), 32 * B, 1.0)

pad = fft_filter(pad, hi=2600) * side
bass = fft_filter(bass, hi=900) * (0.35 + 0.65 * side)
pluck = fft_filter(pluck, lo=250, hi=6000) * (0.5 + 0.5 * side)

# 라이저 (beat 22~28)
r0, r1 = 22 * B, 28 * B
tt = t_(r1 - r0)
riser = rng.standard_normal(len(tt)) * (tt / tt[-1]) ** 2
riser = fft_filter(riser, lo=1500)
rs = np.zeros(N); add(rs, riser, r0, 0.25)

mix = drums * 0.9 + bass * 0.55 + pad * 0.16 + pluck * 0.18 + rs
mix[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
mix /= np.max(np.abs(mix)) * 1.05

# 살짝 스테레오: 플럭/패드 하스
L_ = mix.copy(); R_ = mix.copy()
d = int(0.012 * SR)
wide = pluck * 0.18 + pad * 0.16
wide /= (np.max(np.abs(mix)) * 1.05 + 1e-9)
R_[d:] += wide[:-d] * 0.25; L_ += wide * 0.05
st = np.stack([L_, R_], 1)
st /= np.max(np.abs(st)) * 1.02
with wave.open(out_path, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print("wrote", out_path)
