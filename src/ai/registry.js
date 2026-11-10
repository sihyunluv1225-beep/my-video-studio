// AI 자동 편집 기능 목록.
// 새 AI 기능을 추가할 때는 이 목록에 한 줄을 추가하고 run 함수를 만들면 됩니다.
//
// status
//   'ready'   : 지금 바로 쓸 수 있음 (아이폰 안에서 무료로 동작)
//   'planned' : 다음 단계에서 추가 예정 (설계만 되어 있음)
//
// 원칙: 영상은 아이폰 밖으로 보내지 않습니다. 유료 API·서버는 사용하지 않습니다.
//       외부 서비스가 꼭 필요한 기능은 대표님 승인 후에만 연결합니다.

import { analyzeClip, bestWindowCenter, findStillEdges } from './analyze.js';
import { autoFit } from '../engine/timeline.js';
import { STYLES } from '../engine/presets.js';

export const AI_FEATURES = [
  {
    id: 'highlights',
    name: '주요 장면 추천',
    desc: '움직임을 분석해 스타일에 맞는 장면을 골라 자동으로 구간을 잡아요.',
    status: 'ready',
    how: '아이폰 안에서 움직임 분석',
  },
  {
    id: 'trimStill',
    name: '불필요한 구간 제거',
    desc: '영상 앞뒤의 멈춰 있는 부분(카메라 세팅, 대기 시간)을 잘라내요.',
    status: 'ready',
    how: '아이폰 안에서 움직임 분석',
  },
  {
    id: 'beatSync',
    name: '음악 박자 맞춤 컷',
    desc: 'BPM(빠르기)에 맞춰 컷 길이를 박자 단위로 맞춰요. 탭으로 BPM 측정 가능.',
    status: 'ready',
    how: 'BPM 계산',
  },
  {
    id: 'recommendLook',
    name: '분위기 효과 추천',
    desc: '선택한 스타일과 영상 밝기에 맞는 색감·전환을 추천해 적용해요.',
    status: 'ready',
    how: '규칙 기반 추천',
  },
  {
    id: 'autoCaption',
    name: '한국어 음성 자동 자막',
    desc: '말소리를 듣고 자막을 자동으로 만들어요.',
    status: 'planned',
    how: '예정: 무료 오픈소스 음성인식(Whisper)을 아이폰 안에서 실행',
  },
  {
    id: 'smartTransition',
    name: '자연스러운 화면 전환',
    desc: '장면의 움직임 방향을 보고 어울리는 전환 효과를 자동으로 골라요.',
    status: 'planned',
    how: '예정: 장면 분석 결과 활용 (현재는 스타일별 전환 프리셋 제공)',
  },
  {
    id: 'autoBpm',
    name: '음악 BPM 자동 인식',
    desc: '음악 파일을 듣고 빠르기를 자동으로 알아내요.',
    status: 'planned',
    how: '예정: 아이폰 안에서 음악 파형 분석',
  },
];

/** 여러 영상을 분석해서 결과를 돌려줍니다. (오래 걸릴 수 있어 진행률 표시) */
export async function analyzeAll(clips, cache, onProgress) {
  const out = { ...cache };
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    if (!out[c.id]) {
      out[c.id] = await analyzeClip(c, (p) => onProgress?.((i + p) / clips.length, c));
    }
    onProgress?.((i + 1) / clips.length, c);
  }
  return out;
}

/** 주요 장면 추천 + 길이 맞춤 */
export function applyHighlights(project, analyses) {
  const goal = STYLES[project.style].analysisGoal;
  // 먼저 길이를 나눈 다음, 각 영상에서 가장 좋은 구간을 찾습니다.
  const fitted = autoFit(project.clips, project.duration, { bpm: project.bpm, beatsPerCut: project.beatsPerCut });
  const highlights = {};
  fitted.forEach((c) => {
    const a = analyses[c.id];
    if (a) highlights[c.id] = bestWindowCenter(a, c.out - c.in, goal, c.srcDuration, c.keepIn ?? 0, c.keepOut ?? c.srcDuration);
  });
  return autoFit(project.clips, project.duration, { bpm: project.bpm, beatsPerCut: project.beatsPerCut, highlights });
}

/** 앞뒤 멈춘 구간 잘라내기 */
export function applyTrimStill(project, analyses) {
  return project.clips.map((c) => {
    const a = analyses[c.id];
    if (!a) return c;
    const e = findStillEdges(a, c.srcDuration);
    // 이후 자동 배분/장면 추천도 이 범위 안에서만 고르도록 기억해 둡니다.
    const keep = { keepIn: e.in, keepOut: e.out };
    const nin = Math.max(c.in, e.in);
    const nout = Math.min(c.out, e.out);
    if (nout - nin < 1) return { ...c, ...keep, in: e.in, out: Math.min(e.out, e.in + Math.max(1, c.out - c.in)) };
    return { ...c, ...keep, in: nin, out: nout };
  });
}

/** 분위기 효과 추천 (밝기 + 스타일 기반 규칙) */
export function recommendLook(project, analyses) {
  const all = project.clips.flatMap((c) => analyses[c.id]?.samples || []);
  const bright = all.length ? all.reduce((a, s) => a + s.brightness, 0) / all.length : 0.5;
  const motion = all.length ? all.reduce((a, s) => a + s.motion, 0) / all.length : 10;
  let filter = 'warm';
  let transition = 'fade';
  let reason = '';
  if (project.style === 'class') {
    filter = bright < 0.35 ? 'bright' : 'warm';
    transition = motion > 8 ? 'flash' : 'zoom';
    reason = '수업 현장의 에너지를 살리도록';
  } else if (project.style === 'education') {
    filter = bright < 0.35 ? 'bright' : 'clean';
    transition = 'fade';
    reason = '자세가 정확히 보이도록 색을 과하게 바꾸지 않고';
  } else {
    filter = bright > 0.7 ? 'mono' : 'film';
    transition = 'zoom';
    reason = '광고 같은 고급스러운 분위기로';
  }
  return { filter, transition, reason, bright, motion };
}
