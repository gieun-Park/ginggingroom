# 깅깅룸 (Gingging Room)

귀여운 프레임으로 사진을 꾸미는 포토부스 웹 애플리케이션입니다!

## 프로젝트 구조

```
ginggingroom/
├── index.html           # 메인 HTML 페이지
├── package.json         # 프로젝트 설정
├── README.md           # 이 파일
├── css/
│   └── styles.css      # 전체 스타일
├── js/
│   ├── app.js          # 메인 애플리케이션 로직
│   └── frames.js       # 프레임 데이터 정의
├── assets/
│   └── frames/         # 프레임 이미지 저장소
│       ├── frame-1.png
│       ├── frame-2.png
│       └── ... (15개 프레임)
└── src/                # 추가 소스 파일 (선택사항)
```

## 기능

✨ **주요 기능**
- 📸 이미지 업로드: 로컬에서 사진 업로드
- 📷 카메라 촬영: 웹캠으로 직접 촬영
- 🎭 다양한 프레임: 15가지 귀여운 징징이 프레임 선택
- ⬇️ 다운로드: 완성된 사진을 PNG로 저장
- 📱 반응형 디자인: 모바일, 태블릿, 데스크톱 지원

## 시작하기

### 1. 프레임 이미지 추가

제공된 프레임 이미지를 `assets/frames/` 폴더에 저장합니다:
- `frame-1.png` ~ `frame-15.png`

각 프레임 이미지는 400x500px 해상도로 준비하는 것을 권장합니다.

### 2. 로컬에서 실행

#### Python 설치된 경우
```bash
# 프로젝트 폴더로 이동
cd ginggingroom

# 로컬 서버 실행
python -m http.server 8000

# 브라우저에서 http://localhost:8000 접속
```

#### Node.js 설치된 경우
```bash
# 간단한 http 서버 설치 (선택사항)
npm install -g http-server

# 서버 실행
http-server

# 브라우저에서 http://localhost:8080 접속
```

#### 또는 직접 열기
`index.html`을 웹 브라우저에서 직접 열어서 실행할 수 있습니다.

## 배포하기

### Netlify에 배포 (권장)

1. **Netlify 계정 생성**: https://app.netlify.com/signup

2. **배포 옵션 1: 웹 인터페이스**
   - Netlify 대시보드에서 "Add new site" → "Deploy manually"
   - 프로젝트 폴더를 드래그 앤 드롭

3. **배포 옵션 2: Netlify CLI**
   ```bash
   npm install -g netlify-cli
   netlify deploy
   ```

### GitHub Pages에 배포

1. **GitHub 저장소 생성** (이미 있다면 skip)

2. **프로젝트를 저장소에 푸시**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **GitHub 저장소 설정**
   - Settings → Pages
   - Branch: `main`, Folder: `/ (root)` 선택
   - 저장

4. **배포 확인**
   - GitHub Pages URL에서 사이트 접속 가능

### Vercel에 배포

1. **Vercel 계정 생성**: https://vercel.com

2. **프로젝트 배포**
   ```bash
   npm install -g vercel
   vercel
   ```

### 기타 호스팅 (AWS S3, Google Cloud Storage 등)

정적 사이트 호스팅 서비스에 `index.html`, `css/`, `js/`, `assets/` 폴더를 업로드하면 됩니다.

## 프레임 추가/수정하기

### 새로운 프레임 추가

1. **이미지 준비**
   - 크기: 400x500px (추천)
   - 형식: PNG (투명도 지원)
   - 파일명: `frame-X.png` (X는 번호)

2. **이미지 저장**
   ```
   assets/frames/frame-16.png
   ```

3. **frames.js에 데이터 추가**
   ```javascript
   {
       id: 'frame-16',
       name: '새로운 프레임',
       src: 'assets/frames/frame-16.png',
       offsetX: 0,
       offsetY: 0,
       width: 400,
       height: 500
   }
   ```

## 기술 스택

- **HTML5**: Canvas API를 이용한 이미지 처리
- **CSS3**: 반응형 디자인, 그리드 레이아웃
- **JavaScript (Vanilla)**: 프레임 처리 및 사용자 상호작용
- **Web APIs**:
  - Canvas API (이미지 합성)
  - MediaDevices API (웹캠 접근)
  - File API (이미지 업로드)

## 브라우저 지원

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

## 주의사항

- 카메라 기능 사용 시 HTTPS 연결이 필요합니다 (로컬호스트 제외)
- 대용량 이미지 업로드 시 성능이 저하될 수 있습니다
- 프레임 이미지는 배경이 투명한 PNG 형식 권장

## 커스터마이징

### 색상 변경
[css/styles.css](css/styles.css)에서:
```css
header h1 {
    color: #c41e3a;  /* 빨간색 변경 */
}
```

### 캔버스 크기 변경
[index.html](index.html)에서:
```html
<canvas id="canvas" width="500" height="600"></canvas>
```

그리고 [js/frames.js](js/frames.js)의 프레임 데이터에서 `width`, `height` 수정

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 지원

문제 발생 시:
1. 브라우저 콘솔(F12) 확인
2. 프레임 이미지 경로 확인
3. 브라우저 캐시 삭제

## 개선 사항

향후 추가 가능한 기능:
- [ ] 필터 효과 (세피아, 흑백 등)
- [ ] 스티커 추가
- [ ] SNS 공유 기능
- [ ] 갤러리 기능 (처리된 사진 저장)
- [ ] 서버 백엔드 (사진 저장/공유)

---

**즐거운 포토부스 경험을 즐기세요! 🎉**
