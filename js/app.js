// 상태 관리
const state = {
    currentPhoto: null,
    currentFrame: null,
    selectedFrameId: null
};

// DOM 요소
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const photoInput = document.getElementById('photoInput');
const cameraBtn = document.getElementById('cameraBtn');
const frameGrid = document.getElementById('frameGrid');
const resultArea = document.getElementById('resultArea');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const video = document.getElementById('video');

// 초기화
function init() {
    renderFrameGrid();
    setupEventListeners();
}

// 프레임 그리드 렌더링
function renderFrameGrid() {
    frameGrid.innerHTML = '';

    FRAMES.forEach(frame => {
        const frameItem = document.createElement('div');
        frameItem.className = 'frame-item';
        frameItem.id = frame.id;
        frameItem.title = frame.name;

        const img = document.createElement('img');
        img.src = frame.src;
        img.alt = frame.name;

        frameItem.appendChild(img);
        frameItem.addEventListener('click', () => selectFrame(frame));

        frameGrid.appendChild(frameItem);
    });
}

// 프레임 선택
function selectFrame(frame) {
    state.selectedFrameId = frame.id;
    state.currentFrame = frame;

    // UI 업데이트
    document.querySelectorAll('.frame-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(frame.id).classList.add('active');

    renderCanvas();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    photoInput.addEventListener('change', handlePhotoUpload);
    cameraBtn.addEventListener('click', startCamera);
    downloadBtn.addEventListener('click', downloadPhoto);
    resetBtn.addEventListener('click', reset);
}

// 사진 업로드 처리
function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = function() {
            state.currentPhoto = img;
            renderCanvas();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// 캔버스 렌더링
function renderCanvas() {
    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 배경 색상 설정
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.currentPhoto) {
        // 사진 그리기 (캔버스 크기에 맞게)
        const scale = Math.max(
            canvas.width / state.currentPhoto.width,
            canvas.height / state.currentPhoto.height
        );
        const x = (canvas.width - state.currentPhoto.width * scale) / 2;
        const y = (canvas.height - state.currentPhoto.height * scale) / 2;

        ctx.drawImage(
            state.currentPhoto,
            x,
            y,
            state.currentPhoto.width * scale,
            state.currentPhoto.height * scale
        );
    }

    // 프레임 그리기
    if (state.currentFrame && loadedFrames[state.currentFrame.id]) {
        const frameImg = loadedFrames[state.currentFrame.id];
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    }
}

// 카메라 시작
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
        });

        video.srcObject = stream;
        video.play();

        // 간단한 카메라 UI 표시
        showCameraUI(stream);
    } catch (error) {
        alert('카메라에 접근할 수 없습니다. 권한을 확인하세요.');
        console.error('Camera error:', error);
    }
}

// 카메라 UI 표시
function showCameraUI(stream) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 15px;
        text-align: center;
        max-width: 90%;
    `;

    const videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    videoElement.style.cssText = `
        width: 100%;
        max-width: 400px;
        border-radius: 10px;
        margin-bottom: 15px;
        transform: scaleX(-1);
    `;
    videoElement.play();

    const captureBtn = document.createElement('button');
    captureBtn.textContent = '📸 촬영';
    captureBtn.style.cssText = `
        padding: 12px 30px;
        margin: 10px;
        font-size: 1em;
        background: #c41e3a;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = `
        padding: 12px 30px;
        margin: 10px;
        font-size: 1em;
        background: #f0f0f0;
        border: none;
        border-radius: 8px;
        cursor: pointer;
    `;

    captureBtn.addEventListener('click', () => {
        const canvas2d = document.createElement('canvas');
        canvas2d.width = videoElement.videoWidth;
        canvas2d.height = videoElement.videoHeight;
        const ctx2d = canvas2d.getContext('2d');
        ctx2d.scale(-1, 1);
        ctx2d.drawImage(videoElement, -canvas2d.width, 0);

        const img = new Image();
        img.onload = function() {
            state.currentPhoto = img;
            renderCanvas();
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(modal);
        };
        img.src = canvas2d.toDataURL();
    });

    closeBtn.addEventListener('click', () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
    });

    content.appendChild(videoElement);
    content.appendChild(captureBtn);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

// 사진 다운로드
function downloadPhoto() {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `gingging-photo-${new Date().getTime()}.png`;
    link.click();
}

// 초기화
function reset() {
    state.currentPhoto = null;
    state.currentFrame = null;
    state.selectedFrameId = null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    resultArea.style.display = 'none';
    photoInput.value = '';

    document.querySelectorAll('.frame-item').forEach(item => {
        item.classList.remove('active');
    });
}

// 초기 캔버스 상태
function initCanvas() {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#999';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('사진을 업로드하거나 촬영하세요', canvas.width / 2, canvas.height / 2);
}

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
    init();
    initCanvas();
});
