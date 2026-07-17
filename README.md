# Gingging Room Photo Booth

귀여운 프레임을 실시간 카메라 화면에 올려 촬영하는 정적 웹 포토부스입니다.

## 주요 기능

- 페이지에 들어오면 바로 시작되는 카메라
- 촬영 버튼 위에서 고르는 26개 프레임
- 선택 즉시 카메라 화면에 반영되는 실시간 프레임
- 켜고 끌 수 있는 5초 촬영 타이머
- 촬영 당시의 실제 배경을 그대로 유지하는 Canvas 합성
- 카메라를 사용할 수 없을 때의 이미지 업로드 대체 흐름
- 촬영 결과 다시 찍기와 PNG 다운로드
- 모바일, 태블릿, 데스크톱 반응형 화면

사진, 얼굴 좌표, 합성 Canvas는 모두 브라우저 안에서만 처리되며 서버로 전송되지 않습니다.

## 로컬 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열고 카메라 권한을 허용합니다.

```bash
npm test
npm run build
```

이 프로젝트는 HTML, CSS, Vanilla JavaScript ES 모듈로 구성된 정적 사이트라 별도의 번들링 단계가 없습니다.

## 사용 방법

### 카메라 촬영

1. 페이지를 열고 카메라 권한을 허용합니다.
2. 촬영 버튼 위의 프레임 목록을 좌우로 넘겨 원하는 프레임을 선택합니다.
3. 필요하면 타이머 버튼을 눌러 5초 타이머를 켭니다.
4. 촬영 버튼을 누릅니다.
5. 결과를 다운로드하거나 **다시 찍기**를 눌러 카메라로 돌아갑니다.

선택한 프레임은 촬영 전에 실시간으로 보이며 촬영 결과에도 같은 위치로 합성됩니다. 다시 찍어도 선택한 프레임과 타이머 설정은 유지됩니다.

### 이미지 업로드

카메라 권한이 없거나 카메라를 사용할 수 없을 때 **업로드**를 눌러 기기의 이미지를 선택할 수 있습니다. 업로드한 이미지도 원래 배경을 유지한 채 선택한 프레임과 합성됩니다.

### 다중 얼굴 프레임

브라우저가 화면 속 얼굴을 최대 10명까지 감지하고 선택한 프레임을 각 얼굴에 맞춰 배치합니다. 얼굴 감지가 일시적으로 실패해도 원본 화면과 프레임 합성은 계속 사용할 수 있으며 **프레임 인식 다시 시도**로 감지만 다시 실행할 수 있습니다.

## 프로젝트 구조

```text
ginggingroom/
├── index.html
├── package.json
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── camera-renderer.js
│   ├── camera-session.js
│   ├── face-detection.js
│   ├── face-geometry.js
│   ├── frame-config.js
│   ├── frame-overlay.js
│   ├── frames.js
│   └── photo-session.js
├── assets/
│   ├── frames/
│   │   └── frame_01.png ... frame_26.png
│   └── models/
│       └── face_landmarker.task
└── tests/
```

더 자세한 설명은 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md), 실행 안내는 [QUICKSTART.md](QUICKSTART.md), 프레임 설정은 [FRAMES_CONFIG.md](FRAMES_CONFIG.md)를 참고하세요.

## 브라우저 지원

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

카메라는 보안 컨텍스트에서만 동작하므로 배포 환경에서는 HTTPS가 필요합니다. `localhost`에서는 HTTP로 테스트할 수 있습니다.

## 배포

정적 사이트 호스팅에 저장소 내용을 배포하면 됩니다. 자세한 안내는 [DEPLOYMENT.md](DEPLOYMENT.md)를 참고하세요.

## 라이선스

MIT License
