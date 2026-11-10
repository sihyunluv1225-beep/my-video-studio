import React, { useEffect, useMemo, useState } from 'react';
import { Section, Segmented, Progress } from '../ui.jsx';
import { pickRecorderMime, canExport } from '../../engine/engine.js';

export default function ExportPanel({ project, engine, total, exporting, setExporting, style }) {
  const [quality, setQuality] = useState('1080');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const mime = useMemo(() => pickRecorderMime(), []);
  const supported = useMemo(() => canExport(), []);
  const isMp4 = (mime || '').includes('mp4');

  useEffect(() => () => result && URL.revokeObjectURL(result.url), [result]);

  const start = async () => {
    const eng = engine.current;
    if (!eng) return;
    setErr('');
    setSaveMsg('');
    if (result) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }
    setExporting(true);
    setProgress(0);
    let lock = null;
    try {
      lock = await navigator.wakeLock?.request('screen');
    } catch {
      lock = null;
    }
    try {
      const [w, h] = quality === '1080' ? [1080, 1920] : [720, 1280];
      const out = await eng.exportVideo({ width: w, height: h, fps: 30, onProgress: setProgress });
      const stamp = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const name = `NOWBARRE_${style.id}_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.${out.ext}`;
      const file = new File([out.blob], name, { type: out.blob.type || 'video/mp4' });
      setResult({ file, url: URL.createObjectURL(out.blob), size: out.blob.size, ext: out.ext, name });
    } catch (e) {
      if (e?.message !== 'cancelled') setErr(e?.message || '저장 중 문제가 생겼어요.');
    } finally {
      setExporting(false);
      lock?.release?.().catch?.(() => {});
    }
  };

  const share = async () => {
    setSaveMsg('');
    const data = { files: [result.file] };
    try {
      if (navigator.canShare && navigator.canShare(data)) {
        await navigator.share(data);
        setSaveMsg('공유 창에서 「비디오 저장」을 누르면 사진 앱에 저장돼요.');
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    // 공유를 못 쓰는 경우: 파일로 내려받기
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setSaveMsg('파일로 내려받았어요. 아이폰은 「파일」 앱 → 다운로드 폴더에 있어요.');
  };

  return (
    <div className="panel-inner">
      <Section title="MP4 영상 만들기" hint="화면에 보이는 그대로 영상 파일로 만들어요. 영상 길이만큼 시간이 걸려요. (30초 영상 = 약 30초)">
        <Segmented
          label="화질"
          value={quality}
          options={[
            { id: '1080', name: '고화질 1080×1920' },
            { id: '720', name: '가볍게 720×1280' },
          ]}
          onChange={setQuality}
        />
        <button className="btn primary wide big" onClick={start} disabled={!total || exporting || !supported}>
          {exporting ? `만드는 중 ${Math.round(progress * 100)}%` : `${total.toFixed(1)}초 영상 만들기`}
        </button>
        {exporting && (
          <>
            <Progress value={progress} />
            <p className="sec-hint">완료될 때까지 화면을 끄거나 다른 앱으로 이동하지 마세요.</p>
            <button className="text-btn danger" onClick={() => engine.current?.cancelExport()}>
              취소
            </button>
          </>
        )}
        {!total && <p className="sec-hint">먼저 「영상」 탭에서 영상을 추가해 주세요.</p>}
        {err && <p className="warn">{err}</p>}
      </Section>

      {result && (
        <Section title="완성!" hint={`${result.ext.toUpperCase()} · ${(result.size / 1024 / 1024).toFixed(1)}MB`}>
          <video className="result" src={result.url} controls playsInline />
          <button className="btn primary wide big" onClick={share}>
            사진 앱에 저장하기
          </button>
          {saveMsg && <p className="ok">{saveMsg}</p>}
          <p className="sec-hint">저장 후 인스타그램 → 릴스 → 앨범에서 바로 올릴 수 있어요.</p>
        </Section>
      )}

      <Section title="이 기기 확인">
        <ul className="check">
          <li className={supported ? 'yes' : 'no'}>영상 녹화 기능 {supported ? '사용 가능' : '지원 안 됨'}</li>
          <li className={isMp4 ? 'yes' : 'no'}>
            저장 형식: {mime ? (isMp4 ? 'MP4' : 'WebM (MP4 아님)') : '알 수 없음'}
            {!isMp4 && supported && ' — 아이폰 Safari 에서는 MP4 로 저장돼요.'}
          </li>
          <li className="yes">개인정보: 영상은 이 기기 밖으로 전송되지 않음</li>
        </ul>
      </Section>
    </div>
  );
}
