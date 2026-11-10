import React, { useState } from 'react';
import { Section, Progress } from '../ui.jsx';
import { AI_FEATURES, analyzeAll, applyHighlights, applyTrimStill, recommendLook } from '../../ai/registry.js';
import { autoFit } from '../../engine/timeline.js';
import { FILTERS, TRANSITIONS } from '../../engine/presets.js';

// 분석 결과는 탭을 옮겨도 유지되도록 여기에 보관 (영상별)
const cache = {};

export default function AIPanel({ project, update, style }) {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');
  const clips = project.clips;
  const analyzed = clips.length > 0 && clips.every((c) => cache[c.id]);

  const ensureAnalysis = async () => {
    if (analyzed) return cache;
    setBusy({ p: 0, label: '장면 분석 준비 중' });
    try {
      const res = await analyzeAll(clips, cache, (p) => setBusy({ p, label: `장면 분석 중 ${Math.round(p * 100)}%` }));
      Object.assign(cache, res);
      return cache;
    } finally {
      setBusy(null);
    }
  };

  const run = async (id) => {
    if (!clips.length) return;
    setMsg('');
    try {
      if (id === 'beatSync') {
        update((p) => ({ clips: autoFit(p.clips, p.duration, { bpm: p.bpm, beatsPerCut: p.beatsPerCut }) }));
        setMsg(`${project.bpm}BPM · ${project.beatsPerCut}박마다 컷이 바뀌도록 맞췄어요.`);
        return;
      }
      const a = await ensureAnalysis();
      if (id === 'highlights') {
        update((p) => ({ clips: applyHighlights(p, a) }));
        setMsg(`${style.name} 스타일에 맞는 장면으로 구간을 골랐어요.`);
      } else if (id === 'trimStill') {
        update((p) => ({ clips: applyTrimStill(p, a) }));
        setMsg('앞뒤의 멈춰 있는 구간을 잘라냈어요.');
      } else if (id === 'recommendLook') {
        const r = recommendLook(project, a);
        update({ filter: r.filter, transition: r.transition });
        setMsg(
          `${r.reason} 색감 「${FILTERS.find((f) => f.id === r.filter)?.name}」, 전환 「${TRANSITIONS.find((t) => t.id === r.transition)?.name}」을 적용했어요.`,
        );
      } else if (id === 'oneClick') {
        update((p) => {
          const trimmed = { ...p, clips: applyTrimStill(p, a) };
          const r = recommendLook(trimmed, a);
          return { clips: applyHighlights(trimmed, a), filter: r.filter, transition: r.transition };
        });
        setMsg('불필요한 구간 제거 → 주요 장면 선택 → 박자 맞춤 → 분위기 효과까지 한 번에 적용했어요. 마음에 안 들면 각 탭에서 바로 고칠 수 있어요.');
      }
    } catch (e) {
      setMsg('분석 중 문제가 생겼어요. 영상을 다시 넣거나 앱을 새로 고친 뒤 시도해 주세요.');
    }
  };

  return (
    <div className="panel-inner">
      <Section
        title="AI 원클릭 편집"
        hint="영상을 아이폰 안에서 분석해요. 인터넷으로 보내지 않고, 비용도 들지 않아요. 영상 길이에 따라 10초~1분 정도 걸려요."
      >
        <button className="btn primary wide" onClick={() => run('oneClick')} disabled={!clips.length || !!busy}>
          ✦ {style.name} 스타일로 자동 편집
        </button>
        {busy && <Progress value={busy.p} label={busy.label} />}
        {msg && <p className="ok">{msg}</p>}
        {!clips.length && <p className="sec-hint">먼저 「영상」 탭에서 영상을 추가해 주세요.</p>}
      </Section>

      <Section title="AI 기능 하나씩 쓰기">
        <ul className="ai-list">
          {AI_FEATURES.map((f) => (
            <li key={f.id} className={`ai-item ${f.status}`}>
              <div className="ai-text">
                <span className="ai-name">
                  {f.name}
                  <span className={`pill ${f.status}`}>{f.status === 'ready' ? '사용 가능' : '준비 중'}</span>
                </span>
                <span className="ai-desc">{f.desc}</span>
                <span className="ai-how">{f.how}</span>
              </div>
              {f.status === 'ready' && (
                <button className="btn small" onClick={() => run(f.id)} disabled={!clips.length || !!busy}>
                  적용
                </button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="직접 고르기 · 색감과 전환">
        <p className="field-label">색감</p>
        <div className="seg wrap">
          {FILTERS.map((f) => (
            <button key={f.id} className={project.filter === f.id ? 'on' : ''} onClick={() => update({ filter: f.id })}>
              {f.name}
            </button>
          ))}
        </div>
        <p className="field-label">화면 전환</p>
        <div className="seg wrap">
          {TRANSITIONS.map((t) => (
            <button key={t.id} className={project.transition === t.id ? 'on' : ''} onClick={() => update({ transition: t.id })}>
              {t.name}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
