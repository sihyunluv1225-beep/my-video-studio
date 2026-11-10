// 한 장면(프레임)을 그리는 곳.
// 미리보기와 MP4 저장이 똑같은 함수를 쓰기 때문에, 보이는 그대로 저장됩니다.

import { CAPTION_COLORS } from './presets.js';

export const FONT_SERIF = "'Cormorant Garamond', 'Pretendard Variable', 'Apple SD Gothic Neo', serif";
export const FONT_SANS = "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', sans-serif";

const INK = '#0f0e0c';
const BEIGE = '#e3d3b8';
const INTRO_LEN = 2.2;
const OUTRO_LEN = 3.0;

const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * @param ctx  canvas 2d context
 * @param s    { W, H, t, total, project, segs, segIndex, video, logoImg }
 */
export function drawFrame(ctx, s) {
  const { W, H, t, total, project, segs, segIndex, video } = s;
  const k = W / 1080;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  if (!segs.length) {
    drawEmpty(ctx, W, H, k);
    ctx.restore();
    return;
  }

  const seg = segs[segIndex] || segs[0];
  const local = t - seg.start;
  const segLen = seg.end - seg.start;
  const isFirst = segIndex === 0;
  const isLast = segIndex === segs.length - 1;

  // 1) 영상 (화면 꽉 채우기, 9:16 으로 가운데 자르기)
  let scale = 1;
  if (project.transition === 'zoom') {
    scale = 1 + 0.09 * (1 - ease(local / 0.7));
  }
  if (video && video.readyState >= 2 && video.videoWidth) {
    drawCover(ctx, video, W, H, scale);
  }

  // 2) 색감 필터
  applyFilter(ctx, project.filter, W, H);

  // 3) 화면 전환 효과
  drawTransition(ctx, project.transition, { W, H, local, segLen, isFirst, isLast });

  // 4) 시작/끝 어둡게 (부드러운 시작과 마무리)
  if (t < 0.3 && !s.rest) {
    ctx.fillStyle = INK;
    ctx.globalAlpha = 1 - t / 0.3;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  const brand = project.brand || {};
  const hasOutro = project.outro && total >= 6;
  const hasIntro = project.intro && total >= 6;
  const inIntro = hasIntro && t < INTRO_LEN;
  const inOutro = hasOutro && t > total - OUTRO_LEN;

  // 5) 로고 워터마크
  if (brand.showLogo && !inIntro && !inOutro) {
    drawWatermark(ctx, s, k);
  }

  // 6) 자막
  if (!inOutro) drawCaptions(ctx, s, k);

  // 7) 오프닝 타이틀
  if (inIntro) drawIntro(ctx, s, k, t);

  // 8) 엔딩 (로고 + 슬로건 또는 교육 안내)
  if (inOutro) drawOutro(ctx, s, k, t - (total - OUTRO_LEN));

  // 9) 마지막 0.35초 페이드아웃
  if (t > total - 0.35) {
    ctx.fillStyle = INK;
    ctx.globalAlpha = clamp01((t - (total - 0.35)) / 0.35) * (inOutro ? 0.6 : 1);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawEmpty(ctx, W, H, k) {
  ctx.fillStyle = '#1a1816';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(227,211,184,0.35)';
  ctx.lineWidth = 2 * k;
  ctx.strokeRect(60 * k, 60 * k, W - 120 * k, H - 120 * k);
  ctx.fillStyle = BEIGE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${78 * k}px ${FONT_SERIF}`;
  drawSpaced(ctx, 'NOW BARRE', W / 2, H / 2 - 40 * k, 14 * k);
  ctx.font = `400 ${38 * k}px ${FONT_SANS}`;
  ctx.fillStyle = 'rgba(250,248,244,0.75)';
  ctx.fillText('아래 「영상」 탭에서 영상을 추가해 주세요', W / 2, H / 2 + 60 * k);
}

function drawCover(ctx, video, W, H, scale) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const r = Math.max(W / vw, H / vh) * scale;
  const dw = vw * r;
  const dh = vh * r;
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

export function applyFilter(ctx, filter, W, H) {
  if (!filter || filter === 'clean') return;
  ctx.save();
  if (filter === 'warm') {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(232,196,150,0.45)';
    ctx.fillRect(0, 0, W, H);
  } else if (filter === 'film') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128,128,128,0.3)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(214,190,150,0.35)';
    ctx.fillRect(0, 0, W, H);
    vignette(ctx, W, H, 0.45);
  } else if (filter === 'mono') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, W, H);
    vignette(ctx, W, H, 0.35);
  } else if (filter === 'bright') {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,248,238,0.10)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function vignette(ctx, W, H, strength) {
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawTransition(ctx, type, { W, H, local, segLen, isFirst, isLast }) {
  ctx.save();
  if (type === 'fade') {
    const d = Math.min(0.35, segLen / 3);
    let a = 0;
    if (!isFirst && local < d) a = 1 - local / d;
    if (!isLast && segLen - local < d) a = Math.max(a, 1 - (segLen - local) / d);
    if (a > 0) {
      ctx.fillStyle = INK;
      ctx.globalAlpha = a;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (type === 'flash' && !isFirst) {
    const d = 0.2;
    if (local < d) {
      ctx.fillStyle = '#fffaf2';
      ctx.globalAlpha = 0.85 * (1 - local / d);
      ctx.fillRect(0, 0, W, H);
    }
  } else if (type === 'zoom' && !isFirst) {
    const d = 0.15;
    if (local < d) {
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.7 * (1 - local / d);
      ctx.fillRect(0, 0, W, H);
    }
  }
  ctx.restore();
}

/** 글자 사이 간격을 넓혀서 쓰기 (브랜드 로고 느낌) */
export function drawSpaced(ctx, text, x, y, spacing) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const align = ctx.textAlign;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save();
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.restore();
  return total;
}

function drawWatermark(ctx, s, k) {
  const { W, H, project, logoImg } = s;
  const brand = project.brand;
  const pos = brand.logoPos || 'top-right';
  const margin = 64 * k;
  const top = 120 * k; // 인스타 상단 UI 를 피하도록 조금 내려서
  ctx.save();
  ctx.globalAlpha = 0.92;
  if (logoImg && logoImg.complete && logoImg.naturalWidth) {
    const maxW = 200 * k;
    const maxH = 110 * k;
    const r = Math.min(maxW / logoImg.naturalWidth, maxH / logoImg.naturalHeight);
    const w = logoImg.naturalWidth * r;
    const h = logoImg.naturalHeight * r;
    let x = W - margin - w;
    let y = top;
    if (pos === 'top-left') x = margin;
    if (pos === 'bottom-center') {
      x = (W - w) / 2;
      y = H - 300 * k - h;
    }
    ctx.drawImage(logoImg, x, y, w, h);
  } else {
    ctx.font = `600 ${40 * k}px ${FONT_SERIF}`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 12 * k;
    ctx.textBaseline = 'top';
    let x = W - margin;
    let y = top;
    ctx.textAlign = 'right';
    if (pos === 'top-left') {
      ctx.textAlign = 'left';
      x = margin;
    }
    if (pos === 'bottom-center') {
      ctx.textAlign = 'center';
      x = W / 2;
      y = H - 330 * k;
    }
    drawSpaced(ctx, (brand.brandText || 'NOW BARRE').toUpperCase(), x, y, 8 * k);
  }
  ctx.restore();
}

function captionFont(preset, size, k) {
  const base = { S: 50, M: 62, L: 78 }[size] || 62;
  const px = base * k;
  switch (preset) {
    case 'bold':
      return { font: `800 ${px}px ${FONT_SANS}`, px };
    case 'box':
      return { font: `600 ${px * 0.9}px ${FONT_SANS}`, px: px * 0.9 };
    case 'serif':
      return { font: `italic 500 ${px * 1.1}px ${FONT_SERIF}`, px: px * 1.1 };
    default:
      return { font: `400 ${px * 0.85}px ${FONT_SANS}`, px: px * 0.85 };
  }
}

export function wrapText(ctx, text, maxWidth) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      // 한 단어가 너무 길면 글자 단위로 자르기
      if (ctx.measureText(w).width > maxWidth) {
        let part = '';
        for (const ch of w) {
          if (ctx.measureText(part + ch).width > maxWidth) {
            out.push(part);
            part = ch;
          } else part += ch;
        }
        line = part;
      } else line = w;
    }
    out.push(line);
  }
  return out;
}

function drawCaptions(ctx, s, k) {
  const { W, H, t, project } = s;
  const active = (project.captions || []).filter((c) => c.text && t >= c.start && t < c.end);
  if (!active.length) return;
  const st = project.captionStyle;
  const color = (CAPTION_COLORS.find((c) => c.id === st.color) || CAPTION_COLORS[0]).value;
  const { font, px } = captionFont(st.preset, st.size, k);
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineH = px * 1.32;
  const maxW = W - 180 * k;

  active.forEach((cap, ci) => {
    const lines = wrapText(ctx, cap.text, maxW);
    const blockH = lines.length * lineH;
    let cy;
    if (st.position === 'top') cy = 330 * k + blockH / 2;
    else if (st.position === 'center') cy = H / 2;
    else cy = H - 470 * k - blockH / 2; // 인스타 하단 UI 를 피한 위치
    cy += ci * (blockH + 30 * k);

    // 자막이 나타날 때 살짝 떠오르는 효과
    const age = t - cap.start;
    const left = cap.end - t;
    const a = Math.min(clamp01(age / 0.18), clamp01(left / 0.15));
    const rise = (1 - ease(age / 0.25)) * 18 * k;
    ctx.globalAlpha = a;

    if (st.preset === 'box') {
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 64 * k;
      const h = blockH + 34 * k;
      const boxColor = st.color === 'black' ? 'rgba(250,248,244,0.9)' : 'rgba(15,14,12,0.72)';
      ctx.fillStyle = boxColor;
      roundRect(ctx, W / 2 - w / 2, cy - h / 2 + rise, w, h, 14 * k);
      ctx.fill();
    } else if (st.preset === 'minimal') {
      ctx.fillStyle = color;
      ctx.globalAlpha = a * 0.8;
      ctx.fillRect(W / 2 - 30 * k, cy - blockH / 2 - 28 * k + rise, 60 * k, 2 * k);
      ctx.globalAlpha = a;
    }
    if (st.preset !== 'box') {
      ctx.shadowColor = st.color === 'black' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 14 * k;
      ctx.shadowOffsetY = 2 * k;
    }
    ctx.fillStyle = color;
    lines.forEach((l, i) => {
      ctx.fillText(l, W / 2, cy - blockH / 2 + lineH * (i + 0.5) + rise);
    });
    ctx.shadowColor = 'transparent';
  });
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIntro(ctx, s, k, t) {
  const { W, H, project } = s;
  const brand = project.brand;
  const a = Math.min(ease((t - 0.15) / 0.5), clamp01((INTRO_LEN - t) / 0.4));
  if (a <= 0) return;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.35 * a;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 20 * k;
  const spread = 26 * k + (1 - ease(t / 1.6)) * 18 * k;
  ctx.font = `500 ${112 * k}px ${FONT_SERIF}`;
  drawSpaced(ctx, (brand.brandText || 'NOW BARRE').toUpperCase(), W / 2, H / 2 - 30 * k, spread);
  ctx.fillStyle = BEIGE;
  ctx.fillRect(W / 2 - 50 * k, H / 2 + 50 * k, 100 * k * ease(t / 0.9), 2 * k);
  if (brand.subText) {
    ctx.font = `400 ${36 * k}px ${FONT_SANS}`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    drawSpaced(ctx, brand.subText, W / 2, H / 2 + 110 * k, 10 * k);
  }
  ctx.restore();
}

function drawOutro(ctx, s, k, local) {
  const { W, H, project, logoImg } = s;
  const brand = project.brand;
  const a = ease(local / 0.6);
  ctx.save();
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.74 * a;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rise = (1 - a) * 30 * k;

  if (project.outroMode === 'info') {
    // 교육 일정 / 안내 카드
    const cardW = W - 160 * k;
    ctx.font = `600 ${56 * k}px ${FONT_SANS}`;
    const lines = (brand.infoLines || '').split('\n').filter(Boolean);
    const cardH = 260 * k + lines.length * 72 * k;
    const x = (W - cardW) / 2;
    const y = H / 2 - cardH / 2 + rise;
    ctx.fillStyle = 'rgba(250,248,244,0.96)';
    roundRect(ctx, x, y, cardW, cardH, 8 * k);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `600 ${34 * k}px ${FONT_SERIF}`;
    drawSpaced(ctx, (brand.brandText || 'NOW BARRE').toUpperCase(), W / 2, y + 70 * k, 10 * k);
    ctx.fillStyle = '#b39b78';
    ctx.fillRect(W / 2 - 30 * k, y + 108 * k, 60 * k, 2 * k);
    ctx.fillStyle = INK;
    ctx.font = `700 ${54 * k}px ${FONT_SANS}`;
    const titleLines = wrapText(ctx, brand.infoTitle || '', cardW - 80 * k);
    titleLines.forEach((l, i) => ctx.fillText(l, W / 2, y + 170 * k + i * 64 * k));
    ctx.font = `400 ${40 * k}px ${FONT_SANS}`;
    ctx.fillStyle = '#3d3830';
    const base = y + 170 * k + titleLines.length * 64 * k + 30 * k;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, base + i * 64 * k));
  } else {
    // 로고 + 슬로건
    let y = H / 2 - 40 * k + rise;
    if (logoImg && logoImg.complete && logoImg.naturalWidth) {
      const maxW = 520 * k;
      const maxH = 300 * k;
      const r = Math.min(maxW / logoImg.naturalWidth, maxH / logoImg.naturalHeight);
      const w = logoImg.naturalWidth * r;
      const h = logoImg.naturalHeight * r;
      ctx.drawImage(logoImg, (W - w) / 2, y - h / 2, w, h);
      y += h / 2 + 40 * k;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = `500 ${120 * k}px ${FONT_SERIF}`;
      drawSpaced(ctx, (brand.brandText || 'NOW BARRE').toUpperCase(), W / 2, y, 24 * k);
      y += 90 * k;
    }
    ctx.fillStyle = BEIGE;
    ctx.fillRect(W / 2 - 50 * k, y, 100 * k, 2 * k);
    y += 70 * k;
    if (brand.slogan) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `italic 500 ${58 * k}px ${FONT_SERIF}`;
      wrapText(ctx, brand.slogan, W - 200 * k).forEach((l, i) => ctx.fillText(l, W / 2, y + i * 70 * k));
    } else if (brand.subText) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `400 ${38 * k}px ${FONT_SANS}`;
      drawSpaced(ctx, brand.subText, W / 2, y, 10 * k);
    }
  }
  ctx.restore();
}
