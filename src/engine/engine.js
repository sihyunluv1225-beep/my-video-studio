// 재생 + MP4 저장 엔진.
// 모든 처리는 아이폰(브라우저) 안에서만 이루어지고, 영상이 외부로 전송되지 않습니다.

import { buildSegments, findSegment, totalLength } from './timeline.js';
import { drawFrame } from './renderer.js';

const PREVIEW_W = 540;
const PREVIEW_H = 960;

export function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* 무시 */
    }
  }
  return '';
}

export function canExport() {
  const c = document.createElement('canvas');
  return typeof MediaRecorder !== 'undefined' && typeof c.captureStream === 'function';
}

export class Engine {
  constructor(canvas, host) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d');
    this.host = host; // 숨겨진 비디오 보관함 (아이폰은 화면에 붙어 있어야 프레임을 그려줌)
    this.media = new Map(); // clipId -> { video, src, unlocked }
    this.project = null;
    this.segs = [];
    this.total = 0;
    this.t = 0;
    this.playing = false;
    this.curIdx = -1;
    this.logoImg = null;
    this.audio = null; // { ctx, master, clipGain, musicGain, monitor }
    this.musicEl = null;
    this.musicUrl = '';
    this.onTime = null;
    this.onEnded = null;
    this.onState = null;
    this._raf = 0;
    this._lastAdvance = 0;
    this._lastT = 0;
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
  }

  // ---------- 프로젝트 반영 ----------
  setProject(project) {
    this.project = project;
    this.segs = buildSegments(project.clips, project.duration);
    this.total = totalLength(this.segs);
    this._syncMedia(project.clips);
    this._syncMusic(project.music);
    if (this.audio) {
      this.audio.clipGain.gain.value = project.clipVolume;
      this.audio.musicGain.gain.value = project.musicVolume;
    }
    if (this.t > this.total) this.t = this.total;
    if (!this.playing) this.seek(this.t, true);
  }

  setLogo(img) {
    this.logoImg = img;
    if (!this.playing) this.draw();
  }

  _syncMedia(clips) {
    const ids = new Set(clips.map((c) => c.id));
    for (const [id, m] of this.media) {
      if (!ids.has(id)) {
        m.video.pause();
        m.video.removeAttribute('src');
        m.video.load();
        m.video.remove();
        try {
          m.src?.disconnect();
        } catch {
          /* 무시 */
        }
        this.media.delete(id);
      }
    }
    for (const c of clips) {
      if (this.media.has(c.id)) continue;
      const v = document.createElement('video');
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.preload = 'auto';
      v.muted = false;
      v.src = c.url;
      v.addEventListener('seeked', () => {
        if (!this.playing && this._currentVideo() === v) this.draw();
      });
      v.addEventListener('loadeddata', () => {
        if (!this.playing) this.seek(this.t, true);
      });
      this.host.appendChild(v);
      const m = { video: v, src: null, unlocked: false };
      this.media.set(c.id, m);
      if (this.audio) this._connectElement(m);
    }
  }

  _syncMusic(music) {
    const url = music?.url || '';
    if (url === this.musicUrl) return;
    if (this.musicEl) {
      this.musicEl.pause();
      try {
        this.musicSrc?.disconnect();
      } catch {
        /* 무시 */
      }
      this.musicEl = null;
      this.musicSrc = null;
    }
    this.musicUrl = url;
    if (!url) return;
    const a = new Audio();
    a.preload = 'auto';
    a.src = url;
    a.playsInline = true;
    this.musicEl = a;
    this.musicUnlocked = false;
    if (this.audio) this._connectMusic();
  }

  // ---------- 소리 연결 (Web Audio) ----------
  /** 반드시 사용자가 버튼을 누른 순간에 호출해야 아이폰에서 소리가 납니다. */
  ensureAudio() {
    if (!this.audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const master = ctx.createGain();
      const clipGain = ctx.createGain();
      const musicGain = ctx.createGain();
      const monitor = ctx.createGain();
      clipGain.connect(master);
      musicGain.connect(master);
      master.connect(monitor);
      monitor.connect(ctx.destination);
      clipGain.gain.value = this.project?.clipVolume ?? 0.6;
      musicGain.gain.value = this.project?.musicVolume ?? 0.8;
      this.audio = { ctx, master, clipGain, musicGain, monitor };
      for (const m of this.media.values()) this._connectElement(m);
      if (this.musicEl) this._connectMusic();
    }
    if (this.audio.ctx.state !== 'running') this.audio.ctx.resume().catch(() => {});
    return this.audio;
  }

  _connectElement(m) {
    if (m.src) return;
    try {
      m.src = this.audio.ctx.createMediaElementSource(m.video);
      m.src.connect(this.audio.clipGain);
    } catch (e) {
      console.warn('영상 소리 연결 실패', e);
    }
  }

  _connectMusic() {
    if (this.musicSrc || !this.musicEl) return;
    try {
      this.musicSrc = this.audio.ctx.createMediaElementSource(this.musicEl);
      this.musicSrc.connect(this.audio.musicGain);
    } catch (e) {
      console.warn('음악 연결 실패', e);
    }
  }

  /**
   * 아이폰은 "사용자가 직접 누른 순간"에만 영상 재생을 허락합니다.
   * 화면을 처음 터치할 때 모든 영상을 한 번씩 재생→정지 해서 잠금을 풀어 둡니다.
   */
  unlock() {
    this.ensureAudio();
    const cur = this._currentVideo();
    for (const m of this.media.values()) {
      if (m.unlocked) continue;
      m.unlocked = true;
      const v = m.video;
      if (this.playing && v === cur) continue;
      const keep = v.currentTime;
      const p = v.play();
      if (p && p.then) {
        p.then(() => {
          if (!(this.playing && v === this._currentVideo())) {
            v.pause();
            v.currentTime = keep;
          }
        }).catch(() => {
          m.unlocked = false;
        });
      }
    }
    if (this.musicEl && !this.musicUnlocked) {
      this.musicUnlocked = true;
      const a = this.musicEl;
      const p = a.play();
      if (p && p.then) {
        p.then(() => {
          if (!this.playing) a.pause();
        }).catch(() => {
          this.musicUnlocked = false;
        });
      }
    }
  }

  // ---------- 재생 ----------
  _currentVideo() {
    const seg = this.segs[this.curIdx];
    return seg ? this.media.get(seg.clip.id)?.video : null;
  }

  seek(t, quiet = false) {
    this.t = Math.max(0, Math.min(t, this.total));
    if (!this.segs.length) {
      this.curIdx = -1;
      this.draw();
      return;
    }
    const idx = findSegment(this.segs, this.t);
    this.curIdx = idx;
    const seg = this.segs[idx];
    const v = this.media.get(seg.clip.id)?.video;
    if (v) {
      const target = seg.srcIn + (this.t - seg.start);
      if (Math.abs(v.currentTime - target) > 0.04) {
        try {
          v.currentTime = target;
        } catch {
          /* 아직 로딩 전 */
        }
      }
    }
    this._preseek(idx + 1);
    this.draw();
    if (!quiet) this.onTime?.(this.t);
  }

  _preseek(idx) {
    const seg = this.segs[idx];
    if (!seg) return;
    const v = this.media.get(seg.clip.id)?.video;
    if (v && Math.abs(v.currentTime - seg.srcIn) > 0.04) {
      try {
        v.currentTime = seg.srcIn;
      } catch {
        /* 무시 */
      }
    }
  }

  play() {
    if (this.playing || !this.segs.length) return;
    this.ensureAudio();
    this.unlock();
    if (this.t >= this.total - 0.05) this.seek(0, true);
    this.playing = true;
    this.curIdx = findSegment(this.segs, this.t);
    this._startSegment(this.curIdx, this.t);
    this._startMusic(this.t);
    this._lastAdvance = performance.now();
    this._lastT = this.t;
    this._clockBase = { wall: performance.now(), t: this.t };
    this.onState?.(true);
    this._loop();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this._raf);
    for (const m of this.media.values()) m.video.pause();
    this.musicEl?.pause();
    this.onState?.(false);
    this.draw();
  }

  _startSegment(idx, t) {
    const seg = this.segs[idx];
    if (!seg) return;
    for (const [id, m] of this.media) {
      if (id !== seg.clip.id) m.video.pause();
    }
    const v = this.media.get(seg.clip.id)?.video;
    if (!v) return;
    const target = seg.srcIn + (t - seg.start);
    if (Math.abs(v.currentTime - target) > 0.08) v.currentTime = target;
    v.muted = false;
    const p = v.play();
    if (p && p.catch) p.catch((e) => console.warn('재생 실패', e));
    this._preseek(idx + 1);
    this._clockBase = { wall: performance.now(), t };
  }

  _startMusic(t) {
    const a = this.musicEl;
    if (!a) return;
    const pos = (this.project.music?.offset || 0) + t;
    if (a.duration && pos >= a.duration) return;
    try {
      a.currentTime = pos;
    } catch {
      /* 무시 */
    }
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }

  /** 현재 시간 계산: 영상이 실제로 재생된 위치를 기준으로 (소리와 화면이 어긋나지 않게) */
  _clock() {
    const seg = this.segs[this.curIdx];
    const v = this._currentVideo();
    const wallT = this._clockBase.t + (performance.now() - this._clockBase.wall) / 1000;
    if (!seg || !v) return wallT;
    if (v.ended) return seg.end;
    const vt = seg.start + (v.currentTime - seg.srcIn);
    // 영상이 막 시작하는 중이라면 실제 위치를 사용, 크게 어긋나면 벽시계 사용
    if (Math.abs(vt - wallT) > 0.6 && !v.paused && v.readyState >= 3) {
      this._clockBase = { wall: performance.now(), t: vt };
    }
    return Math.max(seg.start, vt);
  }

  _loop = () => {
    if (!this.playing) return;
    let t = this._clock();
    const seg = this.segs[this.curIdx];
    if (seg && t >= seg.end - 0.01) {
      if (this.curIdx >= this.segs.length - 1) {
        this.t = this.total;
        this.draw();
        this._finish();
        return;
      }
      this.curIdx += 1;
      t = this.segs[this.curIdx].start;
      this._startSegment(this.curIdx, t);
    }
    if (t > this._lastT + 0.001) {
      this._lastT = t;
      this._lastAdvance = performance.now();
    } else if (performance.now() - this._lastAdvance > 1500) {
      // 멈춘 것 같으면 다시 재생 시도
      this._lastAdvance = performance.now();
      this._currentVideo()?.play().catch(() => {});
    }
    // 음악 싱크 보정
    if (this.musicEl && !this.musicEl.paused) {
      const want = (this.project.music?.offset || 0) + t;
      if (Math.abs(this.musicEl.currentTime - want) > 0.25) this.musicEl.currentTime = want;
    }
    this.t = Math.min(t, this.total);
    this.draw();
    this.onTime?.(this.t);
    this._raf = requestAnimationFrame(this._loop);
  };

  _finish() {
    this.playing = false;
    for (const m of this.media.values()) m.video.pause();
    this.musicEl?.pause();
    this.onState?.(false);
    this.onTime?.(this.t);
    this.onEnded?.();
  }

  draw() {
    const { canvas } = this;
    if (!this.project) return;
    drawFrame(this.ctx2d, {
      W: canvas.width,
      H: canvas.height,
      t: this.t,
      total: this.total,
      project: this.project,
      segs: this.segs,
      segIndex: Math.max(0, this.curIdx),
      video: this._currentVideo(),
      logoImg: this.logoImg,
      rest: !this.playing && !this._recording, // 멈춰 있을 때는 시작 페이드를 생략해 장면이 보이도록
    });
  }

  // ---------- MP4 저장 ----------
  /**
   * 화면에 그려지는 장면을 그대로 녹화해서 영상 파일로 만듭니다.
   * (영상 길이만큼 시간이 걸려요. 30초 영상 = 약 30초)
   */
  exportVideo({ width = 1080, height = 1920, fps = 30, onProgress } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.segs.length) return reject(new Error('영상이 없어요.'));
      if (!canExport()) return reject(new Error('이 브라우저는 영상 저장을 지원하지 않아요. 아이폰 Safari 최신 버전을 사용해 주세요.'));
      const mime = pickRecorderMime();
      const audio = this.ensureAudio();
      this.unlock();
      this.pause();

      const canvas = this.canvas;
      canvas.width = width;
      canvas.height = height;
      this.seek(0, true);

      const stream = canvas.captureStream(fps);
      let recDest = null;
      if (audio) {
        recDest = audio.ctx.createMediaStreamDestination();
        audio.master.connect(recDest);
        recDest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      }
      const opts = {
        videoBitsPerSecond: width >= 1080 ? 10_000_000 : 5_000_000,
        audioBitsPerSecond: 128_000,
      };
      if (mime) opts.mimeType = mime;
      let rec;
      try {
        rec = new MediaRecorder(stream, opts);
      } catch (e) {
        try {
          rec = new MediaRecorder(stream);
        } catch (e2) {
          cleanup();
          return reject(e2);
        }
      }
      const chunks = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      const prevTime = this.onTime;
      const prevEnded = this.onEnded;
      const self = this;
      function cleanup() {
        self._recording = false;
        self.onTime = prevTime;
        self.onEnded = prevEnded;
        stream.getTracks().forEach((tr) => tr.stop());
        if (recDest) {
          try {
            audio.master.disconnect(recDest);
          } catch {
            /* 무시 */
          }
        }
        canvas.width = PREVIEW_W;
        canvas.height = PREVIEW_H;
        self.draw();
      }
      rec.onstop = () => {
        const type = rec.mimeType || mime || 'video/mp4';
        cleanup();
        if (self._cancelled) return reject(new Error('cancelled'));
        const blob = new Blob(chunks, { type: type.split(';')[0] });
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        if (!blob.size) reject(new Error('녹화된 내용이 없어요. 다시 시도해 주세요.'));
        else resolve({ blob, mime: type, ext });
      };
      rec.onerror = (e) => {
        cleanup();
        reject(e.error || new Error('녹화 중 오류가 발생했어요.'));
      };

      this._cancelExport = () => {
        this.pause();
        this._cancelled = true;
        if (rec.state !== 'inactive') rec.stop();
      };
      this._cancelled = false;
      this.onTime = (t) => {
        prevTime?.(t);
        onProgress?.(Math.min(1, t / this.total));
      };
      this.onEnded = () => {
        // 마지막 장면이 잘리지 않도록 아주 잠깐 기다렸다가 정지
        setTimeout(() => {
          if (rec.state !== 'inactive') rec.stop();
        }, 250);
      };

      // 첫 장면이 준비될 때까지 잠깐 기다린 뒤 녹화 시작
      const first = this.media.get(this.segs[0].clip.id)?.video;
      const begin = () => {
        if (this._cancelled) return;
        this._recording = true;
        this.draw();
        rec.start(1000);
        this.play();
      };
      if (first && first.readyState >= 2 && !first.seeking) setTimeout(begin, 150);
      else {
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          setTimeout(begin, 150);
        };
        first?.addEventListener('seeked', go, { once: true });
        first?.addEventListener('loadeddata', go, { once: true });
        setTimeout(go, 1500);
      }
    });
  }

  cancelExport() {
    this._cancelExport?.();
  }

  destroy() {
    this.pause();
    for (const m of this.media.values()) {
      m.video.removeAttribute('src');
      m.video.remove();
    }
    this.media.clear();
    this.musicEl?.pause();
    this.audio?.ctx.close().catch(() => {});
  }
}
