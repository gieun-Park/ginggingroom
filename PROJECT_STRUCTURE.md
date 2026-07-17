# 프로젝트 구조

깅깅룸은 별도 서버 없이 브라우저에서 카메라, 얼굴 감지, 프레임 합성, 다운로드를 처리하는 정적 웹 애플리케이션입니다.

```text
ginggingroom/
├── index.html                     # 카메라 중심 화면과 접근성 구조
├── package.json                   # 로컬 서버·테스트 명령
├── css/
│   └── styles.css                 # 카메라 화면, 프레임 레일, 반응형 스타일
├── js/
│   ├── app.js                     # 전체 UI와 카메라 흐름 연결
│   ├── camera-renderer.js         # 미러링된 실시간 화면과 촬영 결과 렌더링
│   ├── camera-session.js          # 카메라 상태, 5초 타이머, 촬영 생명주기
│   ├── face-detection.js          # 사진·비디오 얼굴 감지 서비스
│   ├── face-geometry.js           # 얼굴 좌표와 캔버스 좌표 변환
│   ├── frame-config.js            # 프레임별 얼굴 앵커 설정
│   ├── frame-overlay.js           # 얼굴 위치에 프레임 합성
│   ├── frames.js                  # 26개 프레임 메타데이터와 이미지 로딩
│   └── photo-session.js           # 업로드 사진의 얼굴 분석 상태
├── assets/
│   ├── frames/
│   │   └── frame_01.png ... frame_26.png
│   └── models/
│       └── face_landmarker.task   # 브라우저에서 실행하는 얼굴 감지 모델
└── tests/                         # node:test 단위·통합·자산 계약 테스트
```

## 실행 흐름

1. `app.js`가 페이지 로드와 함께 카메라 세션을 시작합니다.
2. `camera-renderer.js`가 비디오를 좌우 반전해 4:5 Canvas에 맞추고 선택한 프레임을 실시간 합성합니다.
3. `face-detection.js`가 비디오 얼굴을 주기적으로 감지하고, `frame-overlay.js`가 얼굴 위치에 프레임을 배치합니다.
4. 촬영 버튼을 누르면 `camera-session.js`가 즉시 또는 5초 카운트다운 뒤 현재 합성 화면을 고정합니다.
5. 사용자는 결과를 PNG로 다운로드하거나 다시 카메라 화면으로 돌아갑니다.

카메라를 사용할 수 없으면 로컬 이미지 업로드 흐름을 사용할 수 있습니다. 어떤 경로에서도 사진이나 얼굴 데이터가 외부 서버로 전송되지 않으며, 실제 배경은 교체하지 않습니다.

## 프레임 자산

- 위치: `assets/frames/`
- 파일명: `frame_01.png`부터 `frame_26.png`
- 형식: 투명도를 지원하는 PNG
- 설정: `js/frame-config.js`

프레임 추가와 얼굴 앵커 조정 방법은 [FRAMES_CONFIG.md](FRAMES_CONFIG.md)를 참고하세요.
