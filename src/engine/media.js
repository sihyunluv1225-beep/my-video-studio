// 앨범에서 고른 영상/음악/로고 파일을 앱에서 쓸 수 있게 준비합니다.
// 파일은 아이폰 안(브라우저 메모리)에서만 쓰이고 인터넷으로 올라가지 않아요.

let seq = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** 화면에는 안 보이지만 아이폰이 영상을 처리할 수 있도록 붙여두는 보관함 */
export function getHiddenHost() {
  let el = document.getElementById('media-host');
  if (!el) {
    el = document.createElement('div');
    el.id = 'media-host';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '2px',
      height: '2px',
      overflow: 'hidden',
      opacity: '0.01',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    document.body.appendChild(el);
  }
  return el;
}

/** 조용한(음소거) 임시 비디오 — 썸네일과 AI 분석용 */
export function makeProbeVideo(url) {
  const v = document.createElement('video');
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('muted', '');
  v.preload = 'auto';
  v.src = url;
  getHiddenHost().appendChild(v);
  return v;
}

export function disposeVideo(v) {
  v.pause();
  v.removeAttribute('src');
  v.load();
  v.remove();
}

export function waitEvent(el, name, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout:${name}`));
    }, timeout);
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error('media-error'));
    };
    function cleanup() {
      clearTimeout(to);
      el.removeEventListener(name, ok);
      el.removeEventListener('error', bad);
    }
    el.addEventListener(name, ok, { once: true });
    el.addEventListener('error', bad, { once: true });
  });
}

export async function seekTo(v, t) {
  if (Math.abs(v.currentTime - t) < 0.01 && v.readyState >= 2) return;
  const p = waitEvent(v, 'seeked', 6000);
  v.currentTime = t;
  await p;
}

/** 아이폰에서 첫 장면이 그려지도록 잠깐 재생했다 멈추기 (음소거 상태라 허용됨) */
export async function primeVideo(v) {
  try {
    await v.play();
    v.pause();
  } catch {
    /* 무시: 데스크톱 등에서는 필요 없음 */
  }
}

/** 영상 파일 하나를 편집용 조각으로 만들기 */
export async function loadVideoFile(file) {
  const url = URL.createObjectURL(file);
  const v = makeProbeVideo(url);
  try {
    if (v.readyState < 1) await waitEvent(v, 'loadedmetadata', 15000);
    const duration = v.duration;
    if (!isFinite(duration) || duration <= 0) throw new Error('길이를 알 수 없는 영상');
    let thumb = '';
    try {
      if (v.readyState < 2) await waitEvent(v, 'loadeddata', 8000);
      await primeVideo(v);
      await seekTo(v, Math.min(0.5, duration / 2));
      thumb = grabFrame(v, 120);
    } catch {
      thumb = '';
    }
    return {
      id: uid('clip'),
      name: file.name || '영상',
      url,
      srcDuration: duration,
      width: v.videoWidth,
      height: v.videoHeight,
      in: 0,
      out: duration,
      thumb,
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  } finally {
    disposeVideo(v);
  }
}

export function grabFrame(v, width = 120) {
  const h = Math.round((width * 16) / 9);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = h;
  const ctx = c.getContext('2d');
  const r = Math.max(width / v.videoWidth, h / v.videoHeight);
  const dw = v.videoWidth * r;
  const dh = v.videoHeight * r;
  ctx.drawImage(v, (width - dw) / 2, (h - dh) / 2, dw, dh);
  return c.toDataURL('image/jpeg', 0.7);
}

/** 로고 이미지를 적당한 크기로 줄여서 저장해 두기 (다음에 앱을 열어도 유지) */
export function loadLogoFile(file, maxSize = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * r);
      c.height = Math.round(img.naturalHeight * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 열 수 없어요.'));
    };
    img.src = url;
  });
}

export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadMusicFile(file) {
  const url = URL.createObjectURL(file);
  const a = new Audio();
  a.preload = 'metadata';
  a.src = url;
  try {
    await waitEvent(a, 'loadedmetadata', 10000);
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('이 음악 파일은 열 수 없어요.');
  }
  return { url, name: file.name || '음악', duration: a.duration, offset: 0 };
}
