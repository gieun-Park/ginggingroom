# Gingging Room Photo Booth

> 귀여운 프레임으로 사진을 꾸미는 포토부스 웹 애플리케이션

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR_BADGE_ID/deploy-status)](https://app.netlify.com/sites/YOUR_SITE/deploys)

## ✨ 주요 기능

- 🖼️ **귀여운 프레임** - 다양한 캐릭터 프레임
- 📸 **이미지 업로드** - 컴퓨터에서 사진 선택
- 📷 **카메라 촬영** - 웹캠으로 실시간 촬영
- 🎨 **프레임 합성** - Canvas API로 완벽한 합성
- ⬇️ **다운로드** - 완성된 사진을 PNG로 저장
- 📱 **반응형 디자인** - 모바일, 태블릿, 데스크톱 모두 지원

## 🚀 빠른 시작

### 1. 프레임 이미지 준비

`assets/frames/` 폴더에 프레임 이미지를 저장합니다:
- `frame_01.png` ~ `frame_26.png` (총 26개)
- 권장 크기: 480×480px
- 권장 형식: PNG (투명도 지원)

### 2. 로컬에서 실행

```bash
# Python 사용
python -m http.server 8000

# 또는 Node.js 사용
npx http-server

# 브라우저에서 http://localhost:8000 열기
```

### 3. 배포하기

```bash
# Netlify (가장 간단)
1. https://app.netlify.com 접속
2. 폴더 드래그 앤 드롭
3. 완료!

# 또는 GitHub Pages
git push origin main
# Settings → Pages에서 배포 활성화
```

---

## 📁 프로젝트 구조

```
ginggingroom/
├── 📄 index.html              # 메인 페이지
├── 📄 package.json            # 프로젝트 설정
├── 📄 netlify.toml            # Netlify 배포 설정
│
├── 📁 css/
│   └── 📄 styles.css          # 전체 스타일 (반응형 디자인)
│
├── 📁 js/
│   ├── 📄 app.js              # 메인 애플리케이션 로직
│   ├── 📄 face-detection.js   # 브라우저 얼굴 감지
│   ├── 📄 face-geometry.js    # 얼굴 좌표와 캔버스 변환
│   ├── 📄 frame-config.js     # 프레임 앵커 데이터 정의
│   ├── 📄 frame-overlay.js    # 다중 얼굴 프레임 합성
│   ├── 📄 frames.js           # 프레임 이미지 로딩
│   └── 📄 photo-session.js    # 사진별 얼굴 분석 상태 관리
│
├── 📁 assets/
│   ├── 📁 frames/             # 480×480 프레임 이미지 저장소
│   │   ├── frame_01.png
│   │   ├── frame_02.png
│   │   └── ... frame_26.png (총 26개)
│   └── 📁 models/
│       └── face_landmarker.task # 로컬 얼굴 감지 모델
│
└── 📁 tests/                  # 자동화 테스트
```

---

## 🛠️ 기술 스택

| 항목 | 기술 |
|------|------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Image Processing** | Canvas API |
| **Camera** | MediaDevices API |
| **File Handling** | File API |
| **Deployment** | Netlify, GitHub Pages, Vercel |

---

## 🎯 사용 방법

### 사진 업로드
1. **"📸 사진 업로드"** 버튼 클릭
2. 컴퓨터에서 이미지 선택
3. 프레임 선택 (우측 패널)
4. **"⬇️ 다운로드"** 클릭

### 카메라 촬영
1. **"📷 카메라"** 버튼 클릭
2. 권한 허용
3. 화면에 나타난 후 촬영
4. 프레임 선택
5. **"⬇️ 다운로드"** 클릭

### 다중 얼굴 자동 프레임

1. 사진을 업로드하거나 카메라로 촬영합니다.
2. 브라우저가 사진 안의 얼굴을 최대 10명까지 분석합니다.
3. 프레임을 고르면 감지된 모든 얼굴에 같은 프레임이 자동 정렬됩니다.
4. 다른 프레임을 골라도 얼굴 분석 결과를 재사용하므로 바로 변경됩니다.

사진과 얼굴 좌표는 브라우저 안에서만 처리되며 애플리케이션 서버로 전송되지 않습니다.
얼굴이 정면을 향하고 서로 충분히 떨어진 사진에서 가장 자연스럽게 동작합니다.

---

## 🌐 배포

### Netlify (권장)
```bash
1. https://app.netlify.com
2. "Deploy manually" 클릭
3. 폴더 드래그 앤 드롭
```

### GitHub Pages
```bash
git push origin main
# Settings → Pages → Source: main branch
```

### Vercel
```bash
npm install -g vercel
vercel
```

자세한 배포 방법은 [DEPLOYMENT.md](DEPLOYMENT.md) 참고

---

## 📱 브라우저 지원

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

---

## 📚 문서

- [QUICKSTART.md](QUICKSTART.md) - 빠른 시작 가이드
- [DEPLOYMENT.md](DEPLOYMENT.md) - 상세 배포 가이드
- [FRAMES_CONFIG.md](FRAMES_CONFIG.md) - 프레임 커스터마이징
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - 전체 프로젝트 설명

---

## 📄 라이선스

MIT License
