// 프레임 커스터마이징 가이드
// 이 파일은 프레임의 위치와 크기를 세밀하게 조정할 때 사용합니다

/*
프레임 객체 속성:
- id: 고유 식별자 (필수)
- name: 프레임 표시 이름
- src: 이미지 파일 경로 (필수)
- offsetX: X 좌표 오프셋 (픽셀)
- offsetY: Y 좌표 오프셋 (픽셀)
- width: 프레임 너비 (픽셀)
- height: 프레임 높이 (픽셀)

예시:
{
    id: 'frame-1',
    name: '분홍 원피스',
    src: 'assets/frames/frame-1.png',
    offsetX: 0,      // 왼쪽에서의 거리
    offsetY: 0,      // 위에서의 거리
    width: 400,      // 캔버스 너비와 동일
    height: 500      // 캔버스 높이와 동일
}
*/

// 프레임 크기 정보
// 기본 캔버스 크기: 400 x 500px

// 프레임 위치 조정 팁:
// 1. offsetX: 음수면 왼쪽, 양수면 오른쪽
// 2. offsetY: 음수면 위쪽, 양수면 아래쪽
// 3. width/height: 프레임 크기 조정

// 예: 작은 프레임
const smallFrame = {
    id: 'frame-small',
    name: '작은 프레임',
    src: 'assets/frames/small.png',
    offsetX: 50,     // 왼쪽에서 50px
    offsetY: 50,     // 위에서 50px
    width: 300,      // 너비 300px
    height: 400      // 높이 400px
};

// 예: 대형 프레임 (여백 있음)
const largeFrame = {
    id: 'frame-large',
    name: '대형 프레임',
    src: 'assets/frames/large.png',
    offsetX: -50,    // 왼쪽으로 50px 확장
    offsetY: -50,    // 위로 50px 확장
    width: 500,      // 너비 500px (캔버스 초과)
    height: 600      // 높이 600px (캔버스 초과)
};

// 프레임 정렬 가이드
//
// 왼쪽 정렬:
// offsetX: 0
//
// 중앙 정렬:
// offsetX: (400 - frameWidth) / 2
//
// 오른쪽 정렬:
// offsetX: 400 - frameWidth

// 예: 중앙 정렬된 프레임 (width: 350)
const centeredFrame = {
    id: 'frame-centered',
    name: '중앙 정렬 프레임',
    src: 'assets/frames/centered.png',
    offsetX: 25,     // (400 - 350) / 2 = 25
    offsetY: 0,
    width: 350,
    height: 500
};
