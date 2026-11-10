// NOW BARRE 전용 영상 스타일 3가지.
// 각 스타일은 "기본값 묶음"입니다. 사용자가 편집 화면에서 언제든 바꿀 수 있어요.

export const STYLES = {
  class: {
    id: 'class',
    letter: 'A',
    name: 'CLASS REELS',
    korean: '수업 현장 릴스',
    desc: '실제 바레 수업 현장을 리듬감 있게. 125~130BPM 박자에 맞춘 빠른 컷.',
    bpm: 128,
    beatsPerCut: 4, // 4박(1마디)마다 컷
    transition: 'flash',
    filter: 'warm',
    captionPreset: 'bold',
    intro: true,
    outro: true,
    outroMode: 'brand',
    defaultDuration: 15,
    analysisGoal: 'motion', // 움직임이 많은 장면 우선
  },
  education: {
    id: 'education',
    letter: 'B',
    name: 'MASTER EDUCATION',
    korean: '지도자과정 · 강사 교육',
    desc: '티칭 장면과 정확한 자세가 잘 보이도록 차분하게. 교육 일정 안내 포함.',
    bpm: 100,
    beatsPerCut: 8,
    transition: 'fade',
    filter: 'clean',
    captionPreset: 'box',
    intro: false,
    outro: true,
    outroMode: 'info',
    defaultDuration: 30,
    analysisGoal: 'steady', // 흔들림 적고 자세가 잘 보이는 장면 우선
  },
  brand: {
    id: 'brand',
    letter: 'C',
    name: 'BRAND PROMOTION',
    korean: '브랜드 홍보',
    desc: '프리미엄 광고 스타일. 감각적인 전환과 로고 · 슬로건으로 마무리.',
    bpm: 120,
    beatsPerCut: 4,
    transition: 'zoom',
    filter: 'film',
    captionPreset: 'serif',
    intro: true,
    outro: true,
    outroMode: 'brand',
    defaultDuration: 20,
    analysisGoal: 'balanced',
  },
};

export const DURATIONS = [15, 20, 30, 60];

export const TRANSITIONS = [
  { id: 'cut', name: '컷', desc: '바로 넘어가기' },
  { id: 'flash', name: '플래시', desc: '하얗게 번쩍' },
  { id: 'fade', name: '페이드', desc: '부드럽게 어두워졌다 밝아짐' },
  { id: 'zoom', name: '줌', desc: '살짝 당겨지며 시작' },
];

export const FILTERS = [
  { id: 'clean', name: '원본' },
  { id: 'warm', name: '웜 베이지' },
  { id: 'film', name: '필름' },
  { id: 'mono', name: '흑백' },
  { id: 'bright', name: '화사하게' },
];

export const CAPTION_PRESETS = [
  { id: 'bold', name: '굵게' },
  { id: 'box', name: '박스' },
  { id: 'serif', name: '세리프' },
  { id: 'minimal', name: '미니멀' },
];

export const CAPTION_COLORS = [
  { id: 'white', name: '화이트', value: '#ffffff' },
  { id: 'black', name: '블랙', value: '#111111' },
  { id: 'beige', name: '베이지', value: '#e3d3b8' },
];

export const DEFAULT_BRAND = {
  logoDataUrl: '',
  showLogo: true,
  logoPos: 'top-right',
  brandText: 'NOW BARRE',
  subText: '지금바레',
  slogan: '',
  infoTitle: '지도자과정 모집 안내',
  infoLines: '개강일 · 00월 00일\n문의 · 인스타그램 DM',
};

export function newProject(styleId) {
  const s = STYLES[styleId];
  return {
    style: styleId,
    duration: s.defaultDuration,
    clips: [],
    captions: [],
    captionStyle: { preset: s.captionPreset, position: 'bottom', size: 'M', color: 'white' },
    transition: s.transition,
    filter: s.filter,
    intro: s.intro,
    outro: s.outro,
    outroMode: s.outroMode,
    bpm: s.bpm,
    beatsPerCut: s.beatsPerCut,
    music: null, // { url, name, offset }
    musicVolume: 0.8,
    clipVolume: 0.6,
  };
}
