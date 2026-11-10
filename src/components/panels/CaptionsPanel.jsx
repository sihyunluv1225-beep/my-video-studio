import React from 'react';
import { Section, Segmented, Slider } from '../ui.jsx';
import { CAPTION_PRESETS, CAPTION_COLORS } from '../../engine/presets.js';
import { uid } from '../../engine/media.js';
import { round2 } from '../../engine/timeline.js';

const QUICK = {
  class: ['오늘의 바레 클래스', '라인이 살아나는 시간', '지금, 바레'],
  education: ['NOW BARRE 지도자과정', '정확한 티칭 포인트', '마스터 강사 직강'],
  brand: ['NOW BARRE', '지금바레', '당신의 지금을 위한 바레'],
};

export default function CaptionsPanel({ project, update, time, total, seek }) {
  const caps = project.captions;
  const st = project.captionStyle;
  const maxT = Math.max(total, 0.5);

  const add = (text = '') => {
    const start = round2(Math.min(time, Math.max(0, maxT - 1)));
    const end = round2(Math.min(maxT, start + 2.5));
    update({ captions: [...caps, { id: uid('cap'), text, start, end }].sort((a, b) => a.start - b.start) });
  };
  const edit = (id, patch) => update({ captions: caps.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const remove = (id) => update({ captions: caps.filter((c) => c.id !== id) });
  const setStyle = (patch) => update({ captionStyle: { ...st, ...patch } });

  return (
    <div className="panel-inner">
      <Section title="자막 넣기" hint="재생 위치를 원하는 곳에 두고 추가하면, 그 시점부터 2.5초 동안 보여요.">
        <button className="btn primary wide" onClick={() => add()} disabled={!total}>
          + 지금 위치에 자막 추가
        </button>
        <div className="quick">
          {QUICK[project.style].map((q) => (
            <button key={q} className="chip" onClick={() => add(q)} disabled={!total}>
              {q}
            </button>
          ))}
        </div>
        {!total && <p className="sec-hint">먼저 「영상」 탭에서 영상을 추가해 주세요.</p>}
      </Section>

      {caps.length > 0 && (
        <Section title={`자막 목록 (${caps.length})`}>
          <ul className="cap-list">
            {caps.map((c, i) => (
              <li key={c.id} className="cap">
                <div className="cap-head">
                  <button className="text-btn" onClick={() => seek(c.start)}>
                    {i + 1}. {c.start.toFixed(1)}초 ~ {c.end.toFixed(1)}초 ▶
                  </button>
                  <button className="text-btn danger" onClick={() => remove(c.id)}>
                    삭제
                  </button>
                </div>
                <textarea
                  id={`cap-${c.id}`}
                  rows={2}
                  value={c.text}
                  placeholder="자막 내용을 입력하세요 (줄바꿈 가능)"
                  onChange={(e) => edit(c.id, { text: e.target.value })}
                />
                <Slider
                  id={`cs-${c.id}`}
                  label="나타나는 시간"
                  value={c.start}
                  min={0}
                  max={maxT}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}초`}
                  onChange={(v) => {
                    edit(c.id, { start: v, end: Math.max(c.end, round2(v + 0.5)) });
                    seek(v);
                  }}
                />
                <Slider
                  id={`ce-${c.id}`}
                  label="사라지는 시간"
                  value={c.end}
                  min={0}
                  max={maxT}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}초`}
                  onChange={(v) => edit(c.id, { end: Math.max(v, round2(c.start + 0.5)) })}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="자막 스타일">
        <p className="field-label">글씨 모양</p>
        <Segmented label="글씨 모양" value={st.preset} options={CAPTION_PRESETS} onChange={(v) => setStyle({ preset: v })} />
        <p className="field-label">위치</p>
        <Segmented
          label="위치"
          value={st.position}
          options={[
            { id: 'top', name: '위' },
            { id: 'center', name: '가운데' },
            { id: 'bottom', name: '아래' },
          ]}
          onChange={(v) => setStyle({ position: v })}
        />
        <p className="field-label">크기</p>
        <Segmented
          label="크기"
          value={st.size}
          options={[
            { id: 'S', name: '작게' },
            { id: 'M', name: '보통' },
            { id: 'L', name: '크게' },
          ]}
          onChange={(v) => setStyle({ size: v })}
        />
        <p className="field-label">색상</p>
        <div className="swatches">
          {CAPTION_COLORS.map((c) => (
            <button
              key={c.id}
              className={`swatch ${st.color === c.id ? 'on' : ''}`}
              style={{ '--sw': c.value }}
              onClick={() => setStyle({ color: c.id })}
            >
              <span className="swatch-dot" />
              {c.name}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
