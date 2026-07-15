import { createFaceDetectionService } from './face-detection.js';
import { isPlacementVisible, mapPlacementToCanvas, sortPlacementsForDrawing } from './face-geometry.js';
import { drawFrameOverlays, prepareFrameImage } from './frame-overlay.js';
import { FRAMES, loadedFrames, preloadFrames } from './frames.js';
import { createPhotoSession } from './photo-session.js';

export function createApp({
    documentRef = document,
    windowRef = window,
    detector = createFaceDetectionService(),
    overlayDrawer = drawFrameOverlays,
    framePreloader = preloadFrames,
    frameImages = loadedFrames,
    framePreparer = prepareFrameImage
} = {}) {
    const canvas = documentRef.getElementById('canvas');
    const context = canvas.getContext('2d');
    const elements = {
        photoInput: documentRef.getElementById('photoInput'),
        cameraBtn: documentRef.getElementById('cameraBtn'),
        frameGrid: documentRef.getElementById('frameGrid'),
        resultArea: documentRef.getElementById('resultArea'),
        resultImage: documentRef.getElementById('resultImage'),
        downloadBtn: documentRef.getElementById('downloadBtn'),
        resetBtn: documentRef.getElementById('resetBtn'),
        video: documentRef.getElementById('video'),
        faceStatus: documentRef.getElementById('faceStatus'),
        retryDetectionBtn: documentRef.getElementById('retryDetectionBtn')
    };
    const state = { currentPhoto: null, currentFrame: null, selectedFrameId: null };
    const preparedFrames = new Map();
    const session = createPhotoSession({
        detector,
        onChange(analysis) {
            const messages = {
                idle: '',
                loading: '얼굴 분석 중…',
                empty: '얼굴을 찾지 못했어요. 정면 사진으로 다시 시도해주세요.',
                error: '얼굴 인식을 불러오지 못했어요.'
            };
            elements.faceStatus.textContent = analysis.status === 'ready'
                ? (analysis.atLimit
                    ? '얼굴은 최대 10명까지 적용할 수 있어요.'
                    : `얼굴을 ${analysis.faces.length}명 찾았어요.`)
                : messages[analysis.status];
            elements.retryDetectionBtn.hidden = analysis.status !== 'error';
            renderCanvas();
        }
    });

    function init() {
        renderFrameGrid();
        setupEventListeners();
        framePreloader(frameId => {
            if (state.selectedFrameId === frameId) renderCanvas();
        });
        initCanvas();
    }

    function renderFrameGrid() {
        elements.frameGrid.innerHTML = '';

        FRAMES.forEach(frame => {
            const frameItem = documentRef.createElement('div');
            frameItem.className = 'frame-item';
            frameItem.id = frame.id;
            frameItem.title = frame.name;

            const image = documentRef.createElement('img');
            image.src = frame.src;
            image.alt = frame.name;

            frameItem.appendChild(image);
            frameItem.addEventListener('click', () => selectFrame(frame, frameItem));
            elements.frameGrid.appendChild(frameItem);
        });
    }

    function selectFrame(frame, frameItem) {
        state.selectedFrameId = frame.id;
        state.currentFrame = frame;

        documentRef.querySelectorAll('.frame-item').forEach(item => {
            item.classList.remove('active');
        });
        frameItem.classList.add('active');

        renderCanvas();
    }

    function setupEventListeners() {
        elements.photoInput.addEventListener('change', handlePhotoUpload);
        elements.cameraBtn.addEventListener('click', startCamera);
        elements.downloadBtn.addEventListener('click', downloadPhoto);
        elements.resetBtn.addEventListener('click', reset);
        elements.retryDetectionBtn.addEventListener('click', () => session.retry());
    }

    function handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new windowRef.FileReader();
        reader.onload = loadEvent => {
            const image = new windowRef.Image();
            image.onload = () => setPhoto(image);
            image.src = loadEvent.target.result;
        };
        reader.readAsDataURL(file);
    }

    async function setPhoto(image) {
        state.currentPhoto = image;
        renderCanvas();
        await session.analyze(image);
    }

    function renderCanvas() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (!state.currentPhoto) return;

        const imageSize = { width: state.currentPhoto.width, height: state.currentPhoto.height };
        const canvasSize = { width: canvas.width, height: canvas.height };
        const scale = Math.max(canvas.width / imageSize.width, canvas.height / imageSize.height);
        const x = (canvas.width - imageSize.width * scale) / 2;
        const y = (canvas.height - imageSize.height * scale) / 2;
        context.drawImage(
            state.currentPhoto,
            x,
            y,
            imageSize.width * scale,
            imageSize.height * scale
        );

        const analysis = session.getState();
        const frameImage = state.currentFrame && frameImages.get(state.currentFrame.id);
        if (analysis.status !== 'ready' || !frameImage) return;
        if (!preparedFrames.has(state.currentFrame.id)) {
            preparedFrames.set(
                state.currentFrame.id,
                framePreparer(frameImage, state.currentFrame)
            );
        }
        const placements = sortPlacementsForDrawing(
            analysis.faces
                .map(face => mapPlacementToCanvas(face, imageSize, canvasSize))
                .filter(face => isPlacementVisible(face, canvasSize))
        );
        overlayDrawer(
            context,
            preparedFrames.get(state.currentFrame.id),
            state.currentFrame,
            placements
        );
    }

    async function startCamera() {
        try {
            const stream = await windowRef.navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' }
            });

            elements.video.srcObject = stream;
            elements.video.play();
            showCameraUI(stream);
        } catch (error) {
            windowRef.alert('카메라에 접근할 수 없습니다. 권한을 확인하세요.');
            console.error('Camera error:', error);
        }
    }

    function showCameraUI(stream) {
        const modal = documentRef.createElement('div');
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

        const content = documentRef.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            max-width: 90%;
        `;

        const videoElement = documentRef.createElement('video');
        videoElement.srcObject = stream;
        videoElement.style.cssText = `
            width: 100%;
            max-width: 400px;
            border-radius: 10px;
            margin-bottom: 15px;
            transform: scaleX(-1);
        `;
        videoElement.play();

        const captureBtn = documentRef.createElement('button');
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

        const closeBtn = documentRef.createElement('button');
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
            const captureCanvas = documentRef.createElement('canvas');
            captureCanvas.width = videoElement.videoWidth;
            captureCanvas.height = videoElement.videoHeight;
            const captureContext = captureCanvas.getContext('2d');
            captureContext.scale(-1, 1);
            captureContext.drawImage(videoElement, -captureCanvas.width, 0);

            const image = new windowRef.Image();
            image.onload = () => {
                setPhoto(image);
                stopCamera(stream, modal);
            };
            image.src = captureCanvas.toDataURL();
        });

        closeBtn.addEventListener('click', () => stopCamera(stream, modal));

        content.appendChild(videoElement);
        content.appendChild(captureBtn);
        content.appendChild(closeBtn);
        modal.appendChild(content);
        documentRef.body.appendChild(modal);
    }

    function stopCamera(stream, modal) {
        stream.getTracks().forEach(track => track.stop());
        documentRef.body.removeChild(modal);
    }

    function downloadPhoto() {
        const link = documentRef.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `gingging-photo-${new Date().getTime()}.png`;
        link.click();
    }

    function reset() {
        state.currentPhoto = null;
        state.currentFrame = null;
        state.selectedFrameId = null;
        session.reset();
        preparedFrames.clear();

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#f5f5f5';
        context.fillRect(0, 0, canvas.width, canvas.height);

        elements.resultArea.style.display = 'none';
        elements.photoInput.value = '';

        documentRef.querySelectorAll('.frame-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    function initCanvas() {
        context.fillStyle = '#f5f5f5';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#999';
        context.font = '18px Arial';
        context.textAlign = 'center';
        context.fillText(
            '사진을 업로드하거나 촬영하세요',
            canvas.width / 2,
            canvas.height / 2
        );
    }

    return {
        init,
        setPhoto,
        renderCanvas,
        getState: () => ({ ...state, analysis: session.getState() })
    };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('load', () => createApp().init());
}
