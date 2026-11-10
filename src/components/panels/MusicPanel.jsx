import React, { useRef, useState } from 'react';
import { Section, Segmented, Slider, FileButton } from '../ui.jsx';
import { loadMusicFile } from '../../engine/media.js';
import { autoFit } from '../../engine/timeline.js';

export default function MusicPanel({ project, update }) {
  const [err, setErr] = useState('');
  const taps = useRef([]);
  const [tapBpm, setTapBpm] = useState(null);

  const onMusic = async ([file]) => {
    setErr('');
    try {
      const m = await loadMusicFile(file);
      if (project.music?.url) URL.revokeObjectURL(project.music.url);
      update({ music: m });
    } catch (e) {
      setErr(e.message);
    }
  };

  const tap = () => {
    const now = performance.now();
    const arr = taps.current.filter((x) => now - x < 3000);
    arr.push(now);
    taps.current = arr;
    if (arr.length >= 4) {
      const gaps = arr.slice(1).map((x, i) => x - arr[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setTapBpm(Math.round(60000 / avg));
    }
  };

  const applyBeat = (bpm, beatsPerCut = project.beatsPerCut) =>
    update((p) => ({ bpm, beatsPerCut, clips: autoFit(p.clips, p.duration, { bpm, beatsPerCut }) }));

  return (
    <div className="panel-inner">
      <Section title="배경 음악" hint="아이폰 「파일」 앱에 저장된 mp3·m4a 파일을 고를 수 있어요. (Apple Music 스트리밍 곡은 불러올 수 없어요)">
        <FileButton id="music-file" accept="audio/*,.mp3,.m4a,.wav,.aac" onFiles={onMusic} className="btn wide">
          {project.music ? '음악 바꾸기' : '+ 음악 파일 선택'}
        </FileButton>
        {err && <p className="warn">{err}</p>}
        {project.music && (
          <div className="music-card">
            <span className="music-name">♪ {project.music.name}</span>
            <button
              className="text-btn danger"
              onClick={() => {
                URL.revokeObjectURL(project.music.url);
                update({ music: null });
              }}
            >
              빼기
            </button>
          </div>
        )}
        {project.music && (
          <Slider
            id="music-offset"
            label="음악 시작 지점"
            value={project.music.offset}
            min={0}
            max={Math.max(0, (project.music.duration || 0) - 5)}
            step={0.1}
            format={(v) => `${v.toFixed(1)}초부터`}
            onChange={(v) => update({ music: { ...project.music, offset: v } })}
          />
        )}
        <p className="sec-hint">상업적으로 쓰는 영상에는 저작권 걱정 없는 음원(구매·무료 라이선스 음원)을 사용해 주세요.</p>
      </Section>

      <Section title="소리 크기">
        <Slider
          id="vol-clip"
          label="원본 영상 소리"
          value={project.clipVolume}
          min={0}
          max={1}
          step={0.05}
          format={(v) => (v === 0 ? '끔' : `${Math.round(v * 100)}%`)}
          onChange={(v) => update({ clipVolume: v })}
        />
        <Slider
          id="vol-music"
          label="배경 음악"
          value={project.musicVolume}
          min={0}
          max={1}
          step={0.05}
          format={(v) => (v === 0 ? '끔' : `${Math.round(v * 100)}%`)}
          onChange={(v) => update({ musicVolume: v })}
        />
      </Section>

      <Section title="박자 (BPM)" hint="음악의 빠르기예요. 컷 길이를 박자에 맞춰 나눌 때 사용해요. CLASS REELS 는 125~130BPM 을 추천해요.">
        <div className="bpm-row">
          <span className="bpm-num">{project.bpm}</span>
          <span className="bpm-unit">BPM</span>
          <div className="bpm-step">
            <button className="icon-btn" onClick={() => applyBeat(Math.max(60, project.bpm - 1))} aria-label="BPM 1 내리기">
              −
            </button>
            <button className="icon-btn" onClick={() => applyBeat(Math.min(200, project.bpm + 1))} aria-label="BPM 1 올리기">
              +
            </button>
          </div>
        </div>
        <div className="quick">
          {[125, 128, 130].map((b) => (
            <button key={b} className={`chip ${project.bpm === b ? 'on' : ''}`} onClick={() => applyBeat(b)}>
              {b}
            </button>
          ))}
        </div>
        <button className="btn wide tap" onClick={tap}>
          음악에 맞춰 여기를 톡톡 두드리기 {tapBpm ? `· ${tapBpm} BPM` : ''}
        </button>
        {tapBpm && (
          <button className="text-btn" onClick={() => applyBeat(tapBpm)}>
            {tapBpm} BPM 으로 적용하기
          </button>
        )}
        <p className="field-label">몇 박자마다 컷을 바꿀까요?</p>
        <Segmented
          label="컷 간격"
          value={project.beatsPerCut}
          options={[
            { id: 2, name: '2박 (아주 빠르게)' },
            { id: 4, name: '4박 (기본)' },
            { id: 8, name: '8박 (여유있게)' },
          ]}
          onChange={(v) => applyBeat(project.bpm, v)}
        />
        <p className="sec-hint">
          지금 설정: 한 컷 약 {((60 / project.bpm) * project.beatsPerCut).toFixed(2)}초. 바꾸면 영상 구간이 자동으로 다시 나눠져요.
        </p>
      </Section>
    </div>
  );
}
