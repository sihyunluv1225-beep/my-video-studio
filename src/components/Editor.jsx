import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STYLES, DURATIONS, newProject } from '../engine/presets.js';
import { Engine } from '../engine/engine.js';
import { getHiddenHost, loadImage } from '../engine/media.js';
import { buildSegments, totalLength, formatTime } from '../engine/timeline.js';
import { FONT_SANS, FONT_SERIF } from '../engine/renderer.js';
import { loadBrand, saveBrand } from '../storage.js';
import ClipsPanel from './panels/ClipsPanel.jsx';
import CaptionsPanel from './panels/CaptionsPanel.jsx';
import BrandPanel from './panels/BrandPanel.jsx';
import MusicPanel from './panels/MusicPanel.jsx';
import AIPanel from './panels/AIPanel.jsx';
import ExportPanel from './panels/ExportPanel.jsx';

const TABS = [
  { id: 'clips', label: '영상' },
  { id: 'captions', label: '자막' },
  { id: 'brand', label: '브랜드' },
  { id: 'music', label: '음악' },
  { id: 'ai', label: 'AI' },
  { id: 'export', label: '저장' },
];

export default function Editor({ styleId, onExit }) {
  const style = STYLES[styleId];
  const [project, setProject] = useState(() => newProject(styleId));
  const [brand, setBrand] = useState(loadBrand);
  const [tab, setTab] = useState('clips');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const full = useMemo(() => ({ ...project, brand }), [project, brand]);
  const segs = useMemo(() => buildSegments(project.clips, project.duration), [project.clips, project.duration]);
  const total = totalLength(segs);

  // 엔진 준비
  useEffect(() => {
    const eng = new Engine(canvasRef.current, getHiddenHost());
    eng.onTime = setTime;
    eng.onState = setPlaying;
    engineRef.current = eng;
    eng.setProject(full);
    // 글꼴이 준비되면 다시 그리기
    if (document.fonts?.load) {
      Promise.all([
        document.fonts.load(`500 40px ${FONT_SERIF}`),
        document.fonts.load(`italic 500 40px ${FONT_SERIF}`),
        document.fonts.load(`600 40px ${FONT_SERIF}`),
        document.fonts.load(`800 40px ${FONT_SANS}`, '지금바레'),
        document.fonts.load(`400 40px ${FONT_SANS}`, '지금바레'),
      ])
        .catch(() => {})
        .finally(() => eng.draw());
    }
    return () => eng.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setProject(full);
  }, [full]);

  useEffect(() => {
    let alive = true;
    loadImage(brand.logoDataUrl).then((img) => alive && engineRef.current?.setLogo(img));
    return () => {
      alive = false;
    };
  }, [brand.logoDataUrl]);

  useEffect(() => {
    saveBrand(brand);
  }, [brand]);

  // 편집 중에 실수로 페이지를 닫지 않도록
  useEffect(() => {
    const h = (e) => {
      if (project.clips.length) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [project.clips.length]);

  const update = useCallback((patch) => {
    setProject((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
  }, []);

  const seek = useCallback((t) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.pause();
    eng.seek(t);
  }, []);

  const togglePlay = () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.playing) eng.pause();
    else eng.play();
  };

  const tryExit = () => {
    if (project.clips.length) setConfirmExit(true);
    else onExit();
  };

  const panelProps = {
    project,
    update,
    brand,
    setBrand,
    engine: engineRef,
    segs,
    total,
    time,
    seek,
    style,
    setExporting,
    goTab: setTab,
  };

  return (
    <div className="editor" onPointerUp={() => engineRef.current?.unlock()}>
      <header className="ed-head">
        <button className="ghost-btn" onClick={tryExit} disabled={exporting}>
          ← 스타일
        </button>
        <div className="ed-title">
          <span className="ed-style">{style.name}</span>
          <span className="ed-app">NOW BARRE VIDEO STUDIO</span>
        </div>
        <span className="ed-badge">9:16</span>
      </header>

      <section className="stage">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} className="preview" aria-label="영상 미리보기" />
          {!exporting && project.clips.length > 0 && (
            <button className={`play-btn ${playing ? 'is-playing' : ''}`} onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}
        </div>
        <div className="transport">
          <span className="tc">{formatTime(time)}</span>
          <input
            id="scrubber"
            type="range"
            min={0}
            max={Math.max(0.1, total)}
            step={0.05}
            value={Math.min(time, total)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={exporting || !total}
            aria-label="재생 위치"
          />
          <span className="tc">{formatTime(total)}</span>
        </div>
        <div className="durations" role="group" aria-label="영상 길이">
          {DURATIONS.map((d) => (
            <button
              key={d}
              className={`chip ${project.duration === d ? 'on' : ''}`}
              onClick={() => update({ duration: d })}
              disabled={exporting}
            >
              {d}초
            </button>
          ))}
        </div>
        {project.clips.length > 0 && total < project.duration - 0.2 && (
          <p className="stage-note">
            지금 영상은 {total.toFixed(1)}초예요. {project.duration}초를 채우려면 영상을 더 넣거나 「영상」 탭의 자동 배분을 눌러 주세요.
          </p>
        )}
      </section>

      <main className="panel">
        {tab === 'clips' && <ClipsPanel {...panelProps} />}
        {tab === 'captions' && <CaptionsPanel {...panelProps} />}
        {tab === 'brand' && <BrandPanel {...panelProps} />}
        {tab === 'music' && <MusicPanel {...panelProps} />}
        {tab === 'ai' && <AIPanel {...panelProps} />}
        {tab === 'export' && <ExportPanel {...panelProps} exporting={exporting} />}
      </main>

      <nav className="tabbar" aria-label="편집 메뉴">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} disabled={exporting && t.id !== 'export'}>
            {t.label}
          </button>
        ))}
      </nav>

      {confirmExit && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">스타일 선택으로 돌아갈까요?</p>
            <p className="modal-text">지금 편집 중인 영상 목록과 자막은 사라져요. (로고·브랜드 문구는 저장되어 있어요)</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmExit(false)}>
                계속 편집
              </button>
              <button className="btn primary" onClick={onExit}>
                돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
    </svg>
  );
}
