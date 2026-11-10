// 타임라인 계산: 여러 영상 조각을 순서대로 이어 붙였을 때
// "완성 영상의 몇 초에 어떤 영상의 몇 초가 나오는지"를 계산합니다.

export const MIN_CLIP = 0.5; // 한 조각의 최소 길이(초)

export function clipLength(c) {
  return Math.max(0, c.out - c.in);
}

/** 각 조각이 완성 영상에서 시작/끝나는 시간 목록 */
export function buildSegments(clips, maxDuration) {
  const segs = [];
  let t = 0;
  for (let i = 0; i < clips.length; i++) {
    if (t >= maxDuration - 0.01) break;
    const c = clips[i];
    const len = Math.min(clipLength(c), maxDuration - t);
    if (len <= 0.01) continue;
    segs.push({ index: i, clip: c, start: t, end: t + len, srcIn: c.in });
    t += len;
  }
  return segs;
}

export function totalLength(segs) {
  return segs.length ? segs[segs.length - 1].end : 0;
}

export function findSegment(segs, t) {
  for (let i = 0; i < segs.length; i++) {
    if (t < segs[i].end || i === segs.length - 1) return i;
  }
  return -1;
}

/**
 * 자동 맞춤: 선택한 길이(15/20/30/60초)에 딱 맞도록
 * 각 영상의 사용 구간을 나눠 줍니다. bpm 을 주면 박자 단위로 잘라요.
 * highlights 에 영상별 추천 시작점이 있으면 그 위치를 중심으로 자릅니다.
 */
export function autoFit(clips, target, { bpm = 0, beatsPerCut = 4, highlights = {} } = {}) {
  if (!clips.length) return clips;
  const unit = bpm > 0 ? (60 / bpm) * Math.max(1, beatsPerCut) : 0;
  const snap = (x) => (unit ? Math.max(unit, Math.round(x / unit) * unit) : x);

  // 1단계: 균등하게 나누기 (박자 단위로 반올림)
  // 쓸 수 있는 범위 (AI 가 잘라낸 앞뒤 멈춘 구간은 제외)
  const lo = (c) => c.keepIn ?? 0;
  const hi = (c) => c.keepOut ?? c.srcDuration;
  const avail = (c) => Math.max(MIN_CLIP, hi(c) - lo(c));
  const per = target / clips.length;
  let lens = clips.map((c) => Math.min(avail(c), snap(per)));

  // 2단계: 남는 시간 채우기 (여유가 있는 영상에 박자 단위로 추가)
  let guard = 0;
  let sum = lens.reduce((a, b) => a + b, 0);
  while (sum < target - 0.05 && guard++ < 500) {
    let added = false;
    for (let i = 0; i < clips.length && sum < target - 0.05; i++) {
      const room = avail(clips[i]) - lens[i];
      if (room <= 0.05) continue;
      const step = Math.min(room, unit || 0.5, target - sum);
      lens[i] += step;
      sum += step;
      added = true;
    }
    if (!added) break;
  }
  // 3단계: 넘치면 마지막 조각부터 줄이기
  for (let i = clips.length - 1; i >= 0 && sum > target + 0.01; i--) {
    const cut = Math.min(sum - target, lens[i] - MIN_CLIP);
    if (cut > 0) {
      lens[i] -= cut;
      sum -= cut;
    }
  }

  return clips.map((c, i) => {
    const len = Math.max(MIN_CLIP, Math.min(lens[i], avail(c), c.srcDuration));
    const center = highlights[c.id] ?? (lo(c) + hi(c)) / 2;
    let start = center - len / 2;
    start = Math.max(lo(c), Math.min(hi(c) - len, start));
    start = Math.max(0, Math.min(c.srcDuration - len, start));
    return { ...c, in: round2(start), out: round2(start + len) };
  });
}

export function round2(x) {
  return Math.round(x * 100) / 100;
}

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
