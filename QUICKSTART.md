# 빠른 시작 가이드 (Quick Start)

## 1️⃣ 준비물

- 웹 브라우저 (Chrome, Firefox, Safari 등)
- 프레임 이미지 파일들 (15개)

## 2️⃣ 프레임 이미지 준비

`assets/frames/` 폴더에 다음과 같이 이미지를 저장합니다:

```
assets/frames/
├── frame-1.png   # 분홍 원피스
├── frame-2.png   # 노란 원피스
├── frame-3.png   # 체크 스커트
├── frame-4.png   # 분홍 셔츠
├── frame-5.png   # 곰 의상
├── frame-6.png   # 분홍 모자
├── frame-7.png   # 고양이 의상
├── frame-8.png   # 거대 눈
├── frame-9.png   # 물고기 의상
├── frame-10.png  # 초록 생물
├── frame-11.png  # 토끼 의상
├── frame-12.png  # 별 배경
├── frame-13.png  # 곰 머리
├── frame-14.png  # 황금 물고기
└── frame-15.png  # 분홍 토끼
```

## 3️⃣ 로컬에서 테스트하기

### macOS/Linux
```bash
cd ginggingroom
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 열기
```

### Windows
```bash
cd ginggingroom
python -m http.server 8000
# 브라우저에서 http://localhost:8000 열기
```

## 4️⃣ 배포하기 (무료 옵션)

### ✅ Netlify (가장 간단)
1. https://app.netlify.com 에 접속
2. "Deploy manually" 클릭
3. `ginggingroom` 폴더를 드래그 앤 드롭
4. 완료! 자동으로 URL 생성

### ✅ GitHub Pages (무료 + 버전 관리)
1. GitHub에 저장소 생성
2. 파일 업로드
3. Settings → Pages → main branch 선택
4. 완료!

### ✅ Vercel (Netlify와 유사)
1. https://vercel.com 에 접속
2. 저장소 연결
3. 배포 완료

## 5️⃣ 이미지 형식 가이드

**권장 사양:**
- 크기: 400×500 픽셀 (필수)
- 형식: PNG (투명도 지원)
- 색상: RGB 또는 RGBA
- 파일 크기: 1MB 이하

**생성 방법:**
1. Photoshop/GIMP에서 이미지 편집
2. 배경을 투명하게 설정
3. 400×500으로 리사이징
4. PNG로 저장

## 6️⃣ 파일 구조 확인

배포 전에 다음을 확인합니다:

```
✅ index.html 존재
✅ css/styles.css 존재
✅ js/app.js 존재
✅ js/frames.js 존재
✅ assets/frames/ 폴더에 모든 frame-X.png 파일
```

## 7️⃣ 배포 후 확인

배포 URL에서:
1. 📸 사진 업로드 테스트
2. 📷 카메라 촬영 테스트 (권한 허용 필요)
3. 🎭 프레임 선택 테스트
4. ⬇️ 다운로드 테스트

## ⚡ 트러블슈팅

| 문제 | 해결방법 |
|------|--------|
| 프레임이 안 보임 | `assets/frames/` 경로 확인, 브라우저 캐시 삭제 |
| 카메라가 안 됨 | HTTPS 사용 확인 (로컬호스트 제외), 권한 허용 |
| 이미지가 뭉개짐 | 이미지 크기를 400×500으로 수정 |
| 배포 후 스타일 안 먹음 | 브라우저 캐시 삭제 (Ctrl+Shift+Delete) |

## 🎯 다음 단계

- [ ] 모든 프레임 이미지 준비
- [ ] 로컬에서 테스트
- [ ] Netlify/GitHub Pages 배포
- [ ] 친구들과 공유!

---

**도움이 되셨나요? 문제가 있으면 개발자 도구(F12) 콘솔을 확인하세요!**
