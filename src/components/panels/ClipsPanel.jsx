import React, { useState } from 'react';
import { Section, FileButton, Progress } from '../ui.jsx';
import { loadVideoFile } from '../../engine/media.js';
import { autoFit, MIN_CLIP, round2 } from '../../engine/timeline.js';

export default function ClipsPanel({ project, update, segs, seek }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const clips = project.clips;

  const addFiles = async (files) => {
    setError('');
    const added = [];
    const failed = [];
    for (let i = 0; i < files.length; i++) {
      setLoading({ done: i, total: files.length });
      try {
        added.push(await loadVideoFile(files[i]));
      } catch (e) {
        failed.push(files[i].name || `${i + 1}번째 영상`);
      }
    }
    setLoading(null);
    if (failed.length) setError(`열 수 없는 영상이 있어요: ${failed.join(', ')}`);
    if (!added.length) return;
    update((p) => {
      const next = [...p.clips, ...added];
      // 처음 넣을 때는 선택한 길이에 맞게 자동으로 나눠 줍니다.
      return { clips: autoFit(next, p.duration, { bpm: p.bpm, beatsPerCut: p.beatsPerCut }) };
    });
  };

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= clips.length) return;
    const next = [...clips];
    [next[i], next[j]] = [next[j], next[i]];
    update({ clips: next });
  };

  const remove = (id) => {
    const c = clips.find((x) => x.id === id);
    if (c) setTimeout(() => URL.revokeObjectURL(c.url), 1000);
    update({ clips: clips.filter((x) => x.id !== id) });
  };

  const setTrim = (id, patch, seekTo) => {
    update({
      clips: clips.map((c) => {
        if (c.id !== id) return c;
        let nin = patch.in ?? c.in;
        let nout = patch.out ?? c.out;
        if (patch.in !== undefined) nin = Math.min(nin, nout - MIN_CLIP);
        if (patch.out !== undefined) nout = Math.max(nout, nin + MIN_CLIP);
        return { ...c, keepIn: undefined, keepOut: undefined, in: round2(Math.max(0, nin)), out: round2(Math.min(c.srcDuration, nout)) };
      }),
    });
    if (seekTo) requestAnimationFrame(() => seekTo());
  };

  const segOf = (id) => segs.find((s) => s.clip.id === id);
  const used = segs.length ? segs[segs.length - 1].end : 0;

  return (
    <div className="panel-inner">
      <Section title="영상 불러오기" hint="아이폰 앨범에서 여러 개를 한 번에 고를 수 있어요. 고른 순서대로 이어 붙여요.">
        <FileButton id="add-video" accept="video/*" multiple onFiles={addFiles} disabled={!!loading}>
          + 앨범에서 영상 추가
        </FileButton>
        {loading && <Progress value={loading.done / loading.total} label={`영상 준비 중 ${loading.done + 1}/${loading.total}`} />}
        {error && <p className="warn">{error}</p>}
      </Section>

      {clips.length > 0 && (
        <Section
          title={`영상 순서 (${clips.length}개)`}
          aside={
            <button
              className="text-btn"
              onClick={() => update((p) => ({ clips: autoFit(p.clips, p.duration, { bpm: p.bpm, beatsPerCut: p.beatsPerCut }) }))}
            >
              {project.duration}초에 맞게 자동 배분
            </button>
          }
          hint={`사용 중 ${used.toFixed(1)}초 / 목표 ${project.duration}초 · ${project.bpm}BPM 박자 단위로 나눠요.`}
        >
          <ol className="clip-list">
            {clips.map((c, i) => {
              const seg = segOf(c.id);
              const open = openId === c.id;
              return (
                <li key={c.id} className={`clip ${seg ? '' : 'unused'} ${open ? 'open' : ''}`}>
                  <div className="clip-row">
                    <button className="clip-thumb" onClick={() => seg && seek(seg.start)} aria-label={`${i + 1}번 영상으로 이동`}>
                      {c.thumb ? <img src={c.thumb} alt="" /> : <span className="thumb-ph">{i + 1}</span>}
                      <span className="clip-no">{i + 1}</span>
                    </button>
                    <div className="clip-info">
                      <span className="clip-len">{(c.out - c.in).toFixed(1)}초 사용</span>
                      <span className="clip-sub">
                        원본 {c.srcDuration.toFixed(1)}초 · {c.in.toFixed(1)}~{c.out.toFixed(1)}초 구간
                      </span>
                      {!seg && <span className="clip-sub warn-text">목표 길이를 넘어 사용되지 않아요</span>}
                    </div>
                    <div className="clip-actions">
                      <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">
                        ↑
                      </button>
                      <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === clips.length - 1} aria-label="아래로">
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="clip-tools">
                    <button className="text-btn" onClick={() => setOpenId(open ? null : c.id)}>
                      {open ? '자르기 닫기' : '✂ 구간 자르기'}
                    </button>
                    <button className="text-btn danger" onClick={() => remove(c.id)}>
                      삭제
                    </button>
                  </div>
                  {open && (
                    <div className="trim">
                      <TrimBar clip={c} />
                      <label className="slider" htmlFor={`in-${c.id}`}>
                        <span className="slider-top">
                          <span>시작 지점</span>
                          <span className="slider-val">{c.in.toFixed(1)}초</span>
                        </span>
                        <input
                          id={`in-${c.id}`}
                          type="range"
                          min={0}
                          max={c.srcDuration}
                          step={0.1}
                          value={c.in}
                          onChange={(e) =>
                            setTrim(c.id, { in: Number(e.target.value) }, () => {
                              const s = segOf(c.id);
                              if (s) seek(s.start);
                            })
                          }
                        />
                      </label>
                      <label className="slider" htmlFor={`out-${c.id}`}>
                        <span className="slider-top">
                          <span>끝 지점</span>
                          <span className="slider-val">{c.out.toFixed(1)}초</span>
                        </span>
                        <input
                          id={`out-${c.id}`}
                          type="range"
                          min={0}
                          max={c.srcDuration}
                          step={0.1}
                          value={c.out}
                          onChange={(e) =>
                            setTrim(c.id, { out: Number(e.target.value) }, () => {
                              const s = segOf(c.id);
                              if (s) seek(Math.max(s.start, s.end - 0.05));
                            })
                          }
                        />
                      </label>
                      <p className="sec-hint">슬라이더를 움직이면 위 화면에서 그 장면을 바로 보여드려요.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {!clips.length && !loading && (
        <div className="empty">
          <p className="empty-title">아직 영상이 없어요</p>
          <p className="empty-text">
            수업 영상 2~6개를 넣으면 {project.duration}초 릴스로 자동으로 나눠 드려요. 한 영상 안의 좋은 장면은 「AI」 탭에서 골라 줄 수 있어요.
          </p>
        </div>
      )}
    </div>
  );
}

function TrimBar({ clip }) {
  const l = (clip.in / clip.srcDuration) * 100;
  const w = ((clip.out - clip.in) / clip.srcDuration) * 100;
  return (
    <div className="trimbar" aria-hidden="true">
      <div className="trimbar-sel" style={{ left: `${l}%`, width: `${w}%` }} />
    </div>
  );
}
