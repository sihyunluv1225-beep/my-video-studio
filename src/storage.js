// 브랜드 설정(로고, 문구)과 자막 스타일만 이 아이폰에 저장합니다.
// 영상 파일은 저장하지 않아요. (개인정보 보호)

import { DEFAULT_BRAND } from './engine/presets.js';

const KEY = 'nowbarre.brand.v1';

export function loadBrand() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_BRAND, ...JSON.parse(raw) };
  } catch {
    /* 저장소를 못 쓰는 환경 (개인정보 보호 모드 등) */
  }
  return { ...DEFAULT_BRAND };
}

export function saveBrand(brand) {
  try {
    localStorage.setItem(KEY, JSON.stringify(brand));
    return true;
  } catch {
    return false;
  }
}
