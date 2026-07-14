# 배포 가이드 (Deployment Guide)

## 📋 배포 전 체크리스트

- [ ] 모든 프레임 이미지를 `assets/frames/` 에 추가
- [ ] 로컬에서 정상 작동 테스트
- [ ] 이미지 경로 확인
- [ ] 브라우저 호환성 확인

---

## 🚀 배포 방법 (쉬운 순서대로)

### 1️⃣ **Netlify 배포** (가장 쉬움) ⭐ 추천

**장점:**
- 가장 간단한 배포
- 자동 HTTPS
- 무료 인증서
- 빠른 속도

**방법 1: 웹 UI에서 배포 (3단계)**
```
1. https://app.netlify.com 접속
2. "Deploy manually" 클릭
3. ginggingroom 폴더를 드래그 앤 드롭
4. 완료! (자동으로 URL 생성)
```

**방법 2: Netlify CLI로 배포**
```bash
npm install -g netlify-cli
cd ginggingroom
netlify deploy
```

**방법 3: GitHub와 연동 (자동 배포)**
```bash
# 1. GitHub 저장소 생성
# 2. 파일 푸시
git push origin main
# 3. Netlify에서 저장소 연동
# 4. 자동 배포 설정 완료
```

---

### 2️⃣ **GitHub Pages 배포** (무료)

**장점:**
- GitHub 계정만으로 무료 배포
- 버전 관리 포함
- 자동 HTTPS

**단계별 가이드:**

```bash
# 1. 로컬 저장소 초기화
cd ginggingroom
git init
git add .
git commit -m "Initial commit"

# 2. GitHub 저장소 생성
# https://github.com/new 에서 새 저장소 생성

# 3. 원격 저장소 연동
git remote add origin https://github.com/YOUR_USERNAME/ginggingroom.git
git branch -M main
git push -u origin main

# 4. GitHub Pages 활성화
# Settings → Pages → Source: main branch → Save
```

**배포 URL:** `https://YOUR_USERNAME.github.io/ginggingroom`

---

### 3️⃣ **Vercel 배포** (Netlify와 유사)

**장점:**
- Netlify와 유사한 기능
- 빠른 성능
- 미리보기 URL 제공

**방법:**
```bash
npm install -g vercel
cd ginggingroom
vercel
```

또는 웹에서:
1. https://vercel.com 접속
2. GitHub 저장소 연동
3. 자동 배포

---

### 4️⃣ **AWS S3 + CloudFront** (고급)

**장점:**
- 대규모 트래픽 처리 가능
- 글로벌 CDN 제공

**방법:**
```bash
# 1. AWS CLI 설치 및 구성
aws configure

# 2. S3 버킷 생성
aws s3 mb s3://my-photobooth-bucket

# 3. 파일 업로드
aws s3 sync . s3://my-photobooth-bucket --exclude ".git*"

# 4. 웹 호스팅 활성화
# AWS S3 콘솔 → Properties → Static website hosting → Enable
```

---

### 5️⃣ **Google Cloud Storage** (고급)

```bash
# 1. Google Cloud SDK 설치
# https://cloud.google.com/sdk/docs/install

# 2. 인증
gcloud auth login

# 3. 버킷 생성
gsutil mb gs://my-photobooth

# 4. 파일 업로드
gsutil -m cp -r * gs://my-photobooth

# 5. 공개 설정
gsutil iam ch allUsers:objectViewer gs://my-photobooth
```

---

## 🔧 배포 후 설정

### 커스텀 도메인 설정

#### Netlify에서 커스텀 도메인 설정
```
1. 도메인 등록 (GoDaddy, Namecheap 등)
2. Netlify 대시보드 → Domain settings
3. 도메인 추가
4. DNS 설정 완료
```

#### GitHub Pages에서 커스텀 도메인 설정
```
1. 저장소 루트에 CNAME 파일 생성
2. CNAME 파일에 도메인명 입력 (예: myphoto.com)
3. DNS 설정 업데이트
```

---

## 📊 성능 최적화

### 이미지 최적화
```bash
# ImageMagick 사용 예시
convert frame-1.png -quality 85 frame-1-optimized.png

# 또는 TinyPNG (웹): https://tinypng.com
```

### 캐싱 설정
이미 `netlify.toml`에 캐싱 설정이 포함되어 있습니다:
- HTML: 1시간 캐시
- 이미지/JS/CSS: 1년 캐시

---

## 🔐 보안 체크리스트

- [ ] HTTPS 활성화 (자동, Netlify/Vercel/GitHub Pages)
- [ ] 민감한 정보 노출 확인
- [ ] 업로드 파일 검증 (클라이언트 사이드)

---

## 🎯 모니터링 및 분석

### Google Analytics 추가 (선택사항)
```html
<!-- index.html의 </head> 태그 위에 추가 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

---

## 🆘 문제 해결

| 문제 | 원인 | 해결방법 |
|------|------|--------|
| 404 에러 | 파일 경로 오류 | 파일 구조 확인, 경로명 확인 |
| CORS 에러 | 크로스 도메인 | 배포 서버에서 자동 해결 |
| 이미지 로드 안 됨 | 경로 오류 | `assets/frames/` 확인 |
| 카메라 안 됨 | HTTPS 미지원 | HTTPS 배포 필수 |

---

## 📈 다음 단계

배포 후:
1. ✅ 모든 기능 테스트
2. 📱 모바일에서 테스트
3. 📊 분석 추가 (Google Analytics)
4. 🔄 더 많은 프레임 추가
5. 💬 SNS 공유 기능 추가

---

**축하합니다! 이제 포토부스가 온라인에 배포되었습니다! 🎉**
