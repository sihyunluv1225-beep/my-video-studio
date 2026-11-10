// AI 장면 분석 (기본 버전)
// 인터넷 없이 아이폰 안에서 영상의 "움직임 양"을 측정합니다.
// - 움직임이 많은 구간  → 역동적인 장면 (CLASS REELS)
// - 흔들림이 적은 구간  → 자세가 잘 보이는 장면 (MASTER EDUCATION)
// - 처음/끝의 멈춰 있는 구간 → 불필요한 구간

import { makeProbeVideo, disposeVideo, waitEvent, seekTo, primeVideo } from '../engine/media.js';

const SW = 36;
const SH = 64;

/** 영상을 일정 간격으로 훑어보며 움직임 점수를 매깁니다. */
export async function analyzeClip(clip, onProgress) {
  const v = makeProbeVideo(clip.url);
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const samples = [];
  try {
    if (v.readyState < 2) await waitEvent(v, 'loadeddata', 15000);
    await primeVideo(v);
    const dur = clip.srcDuration;
    const count = Math.max(6, Math.min(70, Math.round(dur / 0.4)));
    const step = dur / count;
    let prev = null;
    for (let i = 0; i < count; i++) {
      const t = Math.min(dur - 0.05, i * step + step / 2);
      await seekTo(v, t);
      ctx.drawImage(v, 0, 0, SW, SH);
      const px = ctx.getImageData(0, 0, SW, SH).data;
      const gray = new Float32Array(SW * SH);
      let bright = 0;
      for (let p = 0, j = 0; p < px.length; p += 4, j++) {
        const g = px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114;
        gray[j] = g;
        bright += g;
      }
      let motion = 0;
      if (prev) {
        for (let j = 0; j < gray.length; j++) motion += Math.abs(gray[j] - prev[j]);
        motion /= gray.length;
      }
      samples.push({ t, motion, brightness: bright / gray.length / 255 });
      prev = gray;
      onProgress?.((i + 1) / count);
    }
    if (samples.length > 1) samples[0].motion = samples[1].motion;
    return { step, samples };
  } finally {
    disposeVideo(v);
  }
}

/**
 * 주어진 길이(len)만큼 쓸 때 가장 좋은 구간의 "가운데 시간"을 고릅니다.
 * goal: 'motion' | 'steady' | 'balanced'
 */
export function bestWindowCenter(analysis, len, goal, srcDuration, lo = 0, hi = srcDuration) {
  const samples = analysis.samples.filter((x) => x.t >= lo && x.t <= hi);
  if (!samples.length) return (lo + hi) / 2;
  const maxM = Math.max(...samples.map((s) => s.motion), 1);
  const score = (s) => {
    const m = s.motion / maxM; // 0~1
    const lightOk = s.brightness > 0.12 && s.brightness < 0.95 ? 1 : 0.3; // 너무 어둡거나 하얀 화면 피하기
    if (goal === 'motion') return m * lightOk;
    if (goal === 'steady') return (m > 0.05 ? 1 - Math.abs(m - 0.25) : 0.2) * lightOk; // 적당히 움직이되 차분한 구간
    return (1 - Math.abs(m - 0.5)) * lightOk;
  };
  let best = (lo + hi) / 2;
  let bestScore = -1;
  const half = len / 2;
  for (const s of samples) {
    const center = Math.max(lo + half, Math.min(hi - half, s.t));
    const inWin = samples.filter((x) => x.t >= center - half && x.t <= center + half);
    if (!inWin.length) continue;
    const avg = inWin.reduce((a, x) => a + score(x), 0) / inWin.length;
    if (avg > bestScore) {
      bestScore = avg;
      best = center;
    }
  }
  return best;
}

/** 앞뒤로 멈춰 있는(움직임 거의 없는) 구간을 찾아 잘라낼 위치를 알려줍니다. */
export function findStillEdges(analysis, srcDuration) {
  const { samples, step } = analysis;
  if (samples.length < 4) return { in: 0, out: srcDuration };
  const maxM = Math.max(...samples.map((s) => s.motion), 1);
  const active = (s) => s.motion / maxM > 0.12 && s.brightness > 0.06;
  let a = 0;
  while (a < samples.length - 1 && !active(samples[a])) a++;
  let b = samples.length - 1;
  while (b > a && !active(samples[b])) b--;
  const start = Math.max(0, samples[a].t - step);
  const end = Math.min(srcDuration, samples[b].t + step);
  if (end - start < 1) return { in: 0, out: srcDuration };
  return { in: Math.round(start * 100) / 100, out: Math.round(end * 100) / 100 };
}
