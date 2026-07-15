# 프레임 커스터마이징 가이드

프레임의 얼굴 정렬 위치와 투명 마스크를 조정할 때 `js/frame-config.js`의 프레임 객체를 다음 형식으로 설정합니다.

```js
{
  id: 'frame-1',
  name: '프레임 1',
  src: 'assets/frames/frame_01.png',
  faceAnchor: { centerX: 0.499, centerY: 0.472, width: 0.248, height: 0.177 },
  maskAnchors: [
    { centerX: 0.499, centerY: 0.472, width: 0.248, height: 0.177 }
  ],
  fitPadding: 1.08
}
```

모든 좌표와 크기 값은 480×480 원본 프레임 이미지를 기준으로 0부터 1 사이로 정규화됩니다.

- `faceAnchor`는 감지된 얼굴과 프레임을 맞추는 기준 위치와 크기를 제어합니다.
- `maskAnchors`의 모든 영역은 투명하게 지워집니다. 프레임에 얼굴 구멍이 여러 개라면 각 영역을 배열에 추가합니다.
- `fitPadding`은 감지된 얼굴 주변에 여유 공간을 더합니다. 값이 클수록 얼굴 주위의 여백이 늘어납니다.
