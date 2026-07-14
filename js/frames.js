// 프레임 데이터 - 각 프레임 정보를 정의합니다
const FRAMES = [
    {
        id: 'frame-1',
        name: '프레임 1',
        src: 'assets/frames/frame_01.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-2',
        name: '프레임 2',
        src: 'assets/frames/frame_02.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-3',
        name: '프레임 3',
        src: 'assets/frames/frame_03.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-4',
        name: '프레임 4',
        src: 'assets/frames/frame_04.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-5',
        name: '프레임 5',
        src: 'assets/frames/frame_05.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-6',
        name: '프레임 6',
        src: 'assets/frames/frame_06.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-7',
        name: '프레임 7',
        src: 'assets/frames/frame_07.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-8',
        name: '프레임 8',
        src: 'assets/frames/frame_08.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-9',
        name: '프레임 9',
        src: 'assets/frames/frame_09.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-10',
        name: '프레임 10',
        src: 'assets/frames/frame_10.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-11',
        name: '프레임 11',
        src: 'assets/frames/frame_11.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-12',
        name: '프레임 12',
        src: 'assets/frames/frame_12.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-13',
        name: '프레임 13',
        src: 'assets/frames/frame_13.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-14',
        name: '프레임 14',
        src: 'assets/frames/frame_14.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-15',
        name: '프레임 15',
        src: 'assets/frames/frame_15.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-16',
        name: '프레임 16',
        src: 'assets/frames/frame_16.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-17',
        name: '프레임 17',
        src: 'assets/frames/frame_17.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-18',
        name: '프레임 18',
        src: 'assets/frames/frame_18.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-19',
        name: '프레임 19',
        src: 'assets/frames/frame_19.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-20',
        name: '프레임 20',
        src: 'assets/frames/frame_20.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-21',
        name: '프레임 21',
        src: 'assets/frames/frame_21.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-22',
        name: '프레임 22',
        src: 'assets/frames/frame_22.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-23',
        name: '프레임 23',
        src: 'assets/frames/frame_23.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-24',
        name: '프레임 24',
        src: 'assets/frames/frame_24.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-25',
        name: '프레임 25',
        src: 'assets/frames/frame_25.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    },
    {
        id: 'frame-26',
        name: '프레임 26',
        src: 'assets/frames/frame_26.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    }
];

// 프레임 이미지 미리로드
const loadedFrames = {};

function preloadFrames() {
    FRAMES.forEach(frame => {
        const img = new Image();
        img.src = frame.src;
        img.onload = function() {
            loadedFrames[frame.id] = img;
        };
        img.onerror = function() {
            console.warn(`Failed to load frame: ${frame.src}`);
        };
    });
}

// 앱 로드 시 프레임 미리로드
window.addEventListener('load', preloadFrames);
