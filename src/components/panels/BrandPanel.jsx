import React, { useState } from 'react';
import { Section, Segmented, Toggle, FileButton } from '../ui.jsx';
import { loadLogoFile } from '../../engine/media.js';

export default function BrandPanel({ project, update, brand, setBrand, total, seek }) {
  const [err, setErr] = useState('');
  const set = (patch) => setBrand((b) => ({ ...b, ...patch }));

  const onLogo = async ([file]) => {
    setErr('');
    try {
      set({ logoDataUrl: await loadLogoFile(file), showLogo: true });
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="panel-inner">
      <Section title="로고" hint="배경이 투명한 PNG 로고가 가장 깔끔해요. 한 번 넣으면 이 아이폰에 기억돼요.">
        <div className="logo-row">
          <div className="logo-box">
            {brand.logoDataUrl ? <img src={brand.logoDataUrl} alt="등록된 로고" /> : <span className="logo-ph">{brand.brandText || 'NOW BARRE'}</span>}
          </div>
          <div className="logo-actions">
            <FileButton id="logo-file" accept="image/*" onFiles={onLogo} className="btn">
              {brand.logoDataUrl ? '로고 바꾸기' : '로고 이미지 넣기'}
            </FileButton>
            {brand.logoDataUrl && (
              <button className="text-btn danger" onClick={() => set({ logoDataUrl: '' })}>
                로고 지우기 (글자 로고 사용)
              </button>
            )}
          </div>
        </div>
        {err && <p className="warn">{err}</p>}
        <Toggle id="show-logo" label="영상 위에 로고 표시" checked={brand.showLogo} onChange={(v) => set({ showLogo: v })} />
        {brand.showLogo && (
          <Segmented
            label="로고 위치"
            value={brand.logoPos}
            options={[
              { id: 'top-left', name: '왼쪽 위' },
              { id: 'top-right', name: '오른쪽 위' },
              { id: 'bottom-center', name: '아래 가운데' },
            ]}
            onChange={(v) => set({ logoPos: v })}
          />
        )}
      </Section>

      <Section title="브랜드 문구">
        <label className="field" htmlFor="brand-text">
          <span className="field-label">브랜드 이름 (영문)</span>
          <input id="brand-text" value={brand.brandText} onChange={(e) => set({ brandText: e.target.value })} placeholder="NOW BARRE" />
        </label>
        <label className="field" htmlFor="brand-sub">
          <span className="field-label">한글 이름 / 작은 문구</span>
          <input id="brand-sub" value={brand.subText} onChange={(e) => set({ subText: e.target.value })} placeholder="지금바레" />
        </label>
        <label className="field" htmlFor="brand-slogan">
          <span className="field-label">슬로건 (엔딩 화면에 표시)</span>
          <input id="brand-slogan" value={brand.slogan} onChange={(e) => set({ slogan: e.target.value })} placeholder="예: 지금바레의 슬로건을 입력하세요" />
        </label>
      </Section>

      <Section title="오프닝 · 엔딩">
        <Toggle
          id="intro"
          label="시작 2초 브랜드 타이틀"
          checked={project.intro}
          onChange={(v) => {
            update({ intro: v });
            if (v) seek(1.2);
          }}
        />
        <Toggle
          id="outro"
          label="마지막 3초 엔딩 화면"
          checked={project.outro}
          onChange={(v) => {
            update({ outro: v });
            if (v && total) seek(total - 1.2);
          }}
        />
        {project.outro && (
          <>
            <Segmented
              label="엔딩 종류"
              value={project.outroMode}
              options={[
                { id: 'brand', name: '로고 · 슬로건' },
                { id: 'info', name: '교육 일정 안내' },
              ]}
              onChange={(v) => {
                update({ outroMode: v });
                if (total) seek(total - 1.2);
              }}
            />
            {project.outroMode === 'info' && (
              <>
                <label className="field" htmlFor="info-title">
                  <span className="field-label">안내 제목</span>
                  <input id="info-title" value={brand.infoTitle} onChange={(e) => set({ infoTitle: e.target.value })} />
                </label>
                <label className="field" htmlFor="info-lines">
                  <span className="field-label">안내 내용 (한 줄에 하나씩)</span>
                  <textarea id="info-lines" rows={3} value={brand.infoLines} onChange={(e) => set({ infoLines: e.target.value })} />
                </label>
              </>
            )}
            {total > 0 && (
              <button className="text-btn" onClick={() => seek(total - 1.2)}>
                엔딩 화면 미리보기 ▶
              </button>
            )}
          </>
        )}
        {total > 0 && total < 6 && <p className="sec-hint">오프닝·엔딩은 영상이 6초 이상일 때 나타나요.</p>}
      </Section>
    </div>
  );
}
