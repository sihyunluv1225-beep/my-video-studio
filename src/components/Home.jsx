import React from 'react';
import { STYLES } from '../engine/presets.js';

export default function Home({ onPick }) {
  return (
    <div className="home">
      <header className="home-head">
        <p className="eyebrow">NOW BARRE</p>
        <h1 className="home-title">
          VIDEO
          <br />
          STUDIO
        </h1>
        <p className="home-sub">지금바레 전용 릴스 편집기 · 9:16 세로 영상</p>
      </header>

      <section className="style-list" aria-label="영상 스타일 선택">
        <p className="section-label">어떤 영상을 만들까요?</p>
        {Object.values(STYLES).map((s) => (
          <button key={s.id} className={`style-card style-${s.id}`} onClick={() => onPick(s.id)}>
            <span className="style-letter">{s.letter}</span>
            <span className="style-body">
              <span className="style-name">{s.name}</span>
              <span className="style-korean">{s.korean}</span>
              <span className="style-desc">{s.desc}</span>
              <span className="style-meta">
                기본 {s.defaultDuration}초 · {s.bpm}BPM
              </span>
            </span>
            <span className="style-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </section>

      <footer className="home-foot">
        <p>
          영상은 이 아이폰 안에서만 편집되고
          <br />
          인터넷으로 전송되지 않아요.
        </p>
      </footer>
    </div>
  );
}
