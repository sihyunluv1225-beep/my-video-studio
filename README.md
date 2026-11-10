# NOW BARRE VIDEO STUDIO

지금바레(NOW BARRE) 전용 AI 영상 편집 웹앱입니다. 아이폰 Safari 에서 인스타그램 릴스용 9:16 세로 영상을 만들고 MP4 로 저장합니다.

- 아이폰에서 쓰는 방법: [docs/아이폰-사용법.md](docs/아이폰-사용법.md)
- 기능과 구조 설명: [docs/기능-안내.md](docs/기능-안내.md)

## 개인정보와 비용

- 영상은 아이폰 브라우저 안에서만 처리됩니다. 어떤 서버로도 업로드하지 않습니다.
- 유료 API, 유료 서버를 쓰지 않습니다. 사용한 도구는 모두 무료 오픈소스(React, Vite, Pretendard, Cormorant Garamond)입니다.
- 이 아이폰에 저장되는 것은 로고 이미지와 브랜드 문구뿐입니다.

## 개발자용

```bash
npm install
npm run dev      # 개발 서버 (같은 Wi-Fi 의 아이폰에서 접속 가능)
npm run build    # dist/ 폴더에 배포용 파일 생성
```

폴더 구조

```
src/
  engine/   영상 엔진 (타임라인 계산, 장면 그리기, 재생, MP4 녹화)
  ai/       AI 자동 편집 (장면 분석, 기능 목록 registry.js)
  components/  화면 (홈, 편집기, 탭별 패널)
```
