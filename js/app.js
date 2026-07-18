import { drawLiveComposition, drawSourceCover } from './camera-renderer.js';
import {
  applyCameraZoom,
  CAMERA_ZOOM_OPTIONS,
  getSupportedZoomOptions
} from './camera-controls.js';
import { createCameraSession } from './camera-session.js';
import {
  createFaceDetectionService,
  createLiveFaceDetectionService
} from './face-detection.js';
import { isPlacementVisible, mapPlacementToCanvas, sortPlacementsForDrawing } from './face-geometry.js';
import { drawFrameOverlays, prepareFrameImage } from './frame-overlay.js';
import { FRAMES, loadedFrames, preloadFrames } from './frames.js';
import { createPhotoSession } from './photo-session.js';

const DEFAULT_RENDERING_PROFILE = Object.freeze({ overlayScale: 1, maskScale: 1 });
const MOBILE_CAMERA_RENDERING_PROFILE = Object.freeze({
  overlayScale: 0.8,
  maskScale: 1.25
});
const MOBILE_CAMERA_QUERY = '(max-width: 480px)';
const TIMER_OPTIONS = Object.freeze([0, 3, 5, 7]);

export function createApp({
  documentRef = document,
  windowRef = window,
  detector = createFaceDetectionService(),
  liveDetector = createLiveFaceDetectionService(),
  cameraSessionFactory = createCameraSession,
  sourceDrawer = drawSourceCover,
  liveCompositionDrawer = drawLiveComposition,
  overlayDrawer = drawFrameOverlays,
  framePreloader = preloadFrames,
  frameImages = loadedFrames,
  framePreparer = prepareFrameImage,
  requestAnimationFrameRef = callback => windowRef.requestAnimationFrame(callback),
  cancelAnimationFrameRef = frameId => windowRef.cancelAnimationFrame(frameId)
} = {}) {
  const canvas = documentRef.getElementById('canvas');
  const context = canvas.getContext('2d');
  const elements = {
    photoInput: documentRef.getElementById('photoInput'),
    frameGrid: documentRef.getElementById('frameGrid'),
    framePicker: documentRef.getElementById('framePicker'),
    resultArea: documentRef.getElementById('resultArea'),
    downloadBtn: documentRef.getElementById('downloadBtn'),
    resetBtn: documentRef.getElementById('resetBtn'),
    video: documentRef.getElementById('video'),
    faceStatus: documentRef.getElementById('faceStatus'),
    retryDetectionBtn: documentRef.getElementById('retryDetectionBtn'),
    cameraStatus: documentRef.getElementById('cameraStatus'),
    countdown: documentRef.getElementById('countdown'),
    timerBtn: documentRef.getElementById('timerBtn'),
    timerValue: documentRef.getElementById('timerValue'),
    shutterBtn: documentRef.getElementById('shutterBtn'),
    zoomControls: documentRef.getElementById('zoomControls'),
    zoom05Btn: documentRef.getElementById('zoom05Btn'),
    zoom08Btn: documentRef.getElementById('zoom08Btn'),
    zoom1Btn: documentRef.getElementById('zoom1Btn')
  };
  const zoomButtonElements = [
    elements.zoom05Btn,
    elements.zoom08Btn,
    elements.zoom1Btn
  ];
  const zoomButtons = CAMERA_ZOOM_OPTIONS.map((value, index) => ({
    value,
    element: zoomButtonElements[index]
  }));
  const state = {
    currentPhoto: null,
    currentFrame: null,
    selectedFrameId: null,
    timerSeconds: 0,
    liveFaces: [],
    supportedZooms: [],
    preferredZoom: null,
    currentZoom: null
  };
  let uploadRequestGeneration = 0;
  let renderFrameId = null;
  let lastDetectionAt = -Infinity;
  let liveGeneration = 0;
  let liveDetectionUnavailable = false;
  let playbackGeneration = 0;
  let playbackReady = false;
  let playbackReadyListener = null;
  let activeVideoTrack = null;
  const preparedFrames = new Map();
  const mobileCameraMedia = typeof windowRef.matchMedia === 'function'
    ? windowRef.matchMedia(MOBILE_CAMERA_QUERY)
    : null;

  const faceSession = createPhotoSession({
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
      updateDownloadAvailability();
      renderPhoto();
    }
  });

  const cameraSession = cameraSessionFactory({
    getUserMedia: constraints => windowRef.navigator.mediaDevices.getUserMedia(constraints),
    setTimeoutRef: windowRef.setTimeout.bind(windowRef),
    clearTimeoutRef: windowRef.clearTimeout.bind(windowRef),
    onCapture: captureLiveComposition,
    onChange: handleCameraChange
  });

  function init() {
    renderFrameGrid();
    setupEventListeners();
    framePreloader(frameId => {
      if (state.selectedFrameId !== frameId) return;
      clearPreparedFrameVariants(frameId);
      if (isCameraActive()) renderLiveFrame();
      else if (state.currentPhoto) renderPhoto();
    });
    initCanvas();
    updateTimerControl();
    cameraSession.start();
  }

  function renderFrameGrid() {
    elements.frameGrid.innerHTML = '';

    FRAMES.forEach(frame => {
      const frameItem = documentRef.createElement('button');
      frameItem.type = 'button';
      frameItem.className = 'frame-item';
      frameItem.id = frame.id;
      frameItem.title = frame.name;
      frameItem.setAttribute('aria-pressed', 'false');

      const image = documentRef.createElement('img');
      image.src = frame.src;
      image.alt = frame.name;

      frameItem.appendChild(image);
      frameItem.addEventListener('click', () => selectFrame(frame, frameItem));
      elements.frameGrid.appendChild(frameItem);
    });
  }

  function selectFrame(frame, frameItem) {
    if (cameraSession.getState().status === 'countdown') return;
    state.selectedFrameId = frame.id;
    state.currentFrame = frame;

    Array.from(elements.frameGrid.children).forEach(item => {
      item.setAttribute('aria-pressed', 'false');
    });
    frameItem.setAttribute('aria-pressed', 'true');

    if (isCameraActive()) renderLiveFrame();
    else renderPhoto();
  }

  function setupEventListeners() {
    elements.photoInput.addEventListener('change', handlePhotoUpload);
    elements.downloadBtn.addEventListener('click', downloadPhoto);
    elements.resetBtn.addEventListener('click', retake);
    elements.retryDetectionBtn.addEventListener('click', retryDetection);
    elements.timerBtn.addEventListener('click', toggleTimer);
    elements.shutterBtn.addEventListener('click', startCapture);
    zoomButtons.forEach(({ value, element }) => {
      element.addEventListener('click', () => selectZoom(value));
    });
    windowRef.addEventListener('beforeunload', destroy);
  }

  function clearPlaybackReadyListener() {
    if (!playbackReadyListener) return;
    elements.video.removeEventListener?.('loadeddata', playbackReadyListener);
    playbackReadyListener = null;
  }

  function invalidatePlayback() {
    clearZoomStream();
    playbackGeneration += 1;
    playbackReady = false;
    clearPlaybackReadyListener();
  }

  function updateCaptureControls() {
    const camera = cameraSession.getState();
    const captureReady = camera.status === 'live' && playbackReady;
    elements.shutterBtn.disabled = !captureReady;
    elements.timerBtn.disabled = !captureReady;
    zoomButtons.forEach(({ element }) => {
      element.disabled = !captureReady;
    });
  }

  function clearZoomStream() {
    activeVideoTrack = null;
    state.supportedZooms = [];
    state.currentZoom = null;
    elements.zoomControls.hidden = true;
    zoomButtons.forEach(({ element }) => {
      element.hidden = false;
      element.disabled = true;
      element.setAttribute('aria-pressed', 'false');
    });
  }

  function updateZoomSelection() {
    zoomButtons.forEach(({ value, element }) => {
      element.hidden = !state.supportedZooms.includes(value);
      element.setAttribute('aria-pressed', String(state.currentZoom === value));
    });
  }

  async function configureZoom(stream, generation) {
    const track = stream?.getVideoTracks?.()[0] ?? stream?.getTracks?.()[0] ?? null;
    if (generation !== playbackGeneration || !playbackReady || !track) return;
    activeVideoTrack = track;
    state.supportedZooms = getSupportedZoomOptions(track.getCapabilities?.());
    const reportedZoom = track.getSettings?.().zoom;
    state.currentZoom = state.supportedZooms.includes(reportedZoom) ? reportedZoom : null;
    updateZoomSelection();
    elements.zoomControls.hidden = state.supportedZooms.length < 2;
    updateCaptureControls();

    if (
      state.preferredZoom !== null
      && state.supportedZooms.includes(state.preferredZoom)
      && state.currentZoom !== state.preferredZoom
    ) {
      await selectZoom(state.preferredZoom, { generation, track });
    }
  }

  async function selectZoom(
    zoom,
    {
      generation = playbackGeneration,
      track = activeVideoTrack
    } = {}
  ) {
    if (
      cameraSession.getState().status !== 'live'
      || !playbackReady
      || track !== activeVideoTrack
      || !state.supportedZooms.includes(zoom)
    ) return;

    zoomButtons.forEach(({ element }) => {
      element.disabled = true;
    });
    try {
      await applyCameraZoom(track, zoom);
    } catch {
      if (generation !== playbackGeneration || track !== activeVideoTrack) return;
      elements.zoomControls.hidden = true;
      elements.cameraStatus.textContent = '이 기기에서는 카메라 배율을 바꿀 수 없어요.';
      return;
    } finally {
      if (generation === playbackGeneration && track === activeVideoTrack) {
        updateCaptureControls();
      }
    }

    if (generation !== playbackGeneration || track !== activeVideoTrack) return;
    state.currentZoom = zoom;
    state.preferredZoom = zoom;
    updateZoomSelection();
  }

  function exposeCameraFallback() {
    elements.cameraStatus.textContent = '카메라를 사용할 수 없어요. 사진을 업로드해주세요.';
    elements.photoInput.disabled = false;
    elements.framePicker.hidden = false;
  }

  function failPlayback(generation) {
    if (generation !== playbackGeneration || cameraSession.getState().status !== 'live') return;
    invalidatePlayback();
    stopLiveLoop();
    cameraSession.destroy();
    exposeCameraFallback();
  }

  function markPlaybackReady(generation) {
    if (generation !== playbackGeneration || cameraSession.getState().status !== 'live') return;
    if (!elements.video.videoWidth || !elements.video.videoHeight) {
      clearPlaybackReadyListener();
      const listener = () => {
        if (playbackReadyListener === listener) playbackReadyListener = null;
        markPlaybackReady(generation);
      };
      playbackReadyListener = listener;
      elements.video.addEventListener('loadeddata', listener, { once: true });
      return;
    }
    clearPlaybackReadyListener();
    playbackReady = true;
    elements.cameraStatus.textContent = '카메라 준비 완료';
    updateCaptureControls();
    void configureZoom(elements.video.srcObject, generation);
    startLiveLoop();
  }

  function startPlayback(stream) {
    invalidatePlayback();
    const generation = playbackGeneration;
    elements.video.srcObject = stream;
    elements.cameraStatus.textContent = '카메라를 준비하는 중…';
    updateCaptureControls();
    let playback;
    try {
      playback = elements.video.play();
    } catch {
      failPlayback(generation);
      return;
    }
    Promise.resolve(playback)
      .then(() => markPlaybackReady(generation))
      .catch(() => failPlayback(generation));
  }

  function handlePhotoUpload(event) {
    const requestGeneration = ++uploadRequestGeneration;
    const file = event.target.files[0];
    if (!file) return;

    const reader = new windowRef.FileReader();
    reader.onload = loadEvent => {
      if (requestGeneration !== uploadRequestGeneration) return;
      const image = new windowRef.Image();
      image.onload = () => {
        if (requestGeneration !== uploadRequestGeneration) return;
        commitPhoto(image);
      };
      image.src = loadEvent.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function setPhoto(image) {
    uploadRequestGeneration += 1;
    return commitPhoto(image);
  }

  async function commitPhoto(image) {
    state.currentPhoto = image;
    state.liveFaces = [];
    cameraSession.enterReview();
    renderPhoto();
    await faceSession.analyze(image);
  }

  function getCameraRenderingProfile() {
    return mobileCameraMedia?.matches
      ? MOBILE_CAMERA_RENDERING_PROFILE
      : DEFAULT_RENDERING_PROFILE;
  }

  function clearPreparedFrameVariants(frameId) {
    const prefix = `${frameId}:`;
    for (const cacheKey of preparedFrames.keys()) {
      if (cacheKey.startsWith(prefix)) preparedFrames.delete(cacheKey);
    }
  }

  function getPreparedFrame(maskScale = 1) {
    if (!state.currentFrame) return null;
    const frameImage = frameImages.get(state.currentFrame.id);
    if (!frameImage) return null;
    const cacheKey = `${state.currentFrame.id}:${maskScale}`;
    if (!preparedFrames.has(cacheKey)) {
      preparedFrames.set(
        cacheKey,
        framePreparer(frameImage, state.currentFrame, { maskScale })
      );
    }
    return preparedFrames.get(cacheKey);
  }

  function renderPhoto() {
    if (!state.currentPhoto) return;
    const canvasSize = { width: canvas.width, height: canvas.height };
    const imageSize = {
      width: state.currentPhoto.naturalWidth || state.currentPhoto.width,
      height: state.currentPhoto.naturalHeight || state.currentPhoto.height
    };
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    sourceDrawer(context, state.currentPhoto, imageSize, canvasSize);

    const analysis = faceSession.getState();
    const preparedFrame = getPreparedFrame(DEFAULT_RENDERING_PROFILE.maskScale);
    if (analysis.status !== 'ready' || !preparedFrame || !state.currentFrame) return;
    const placements = sortPlacementsForDrawing(
      analysis.faces
        .map(face => mapPlacementToCanvas(face, imageSize, canvasSize))
        .filter(face => isPlacementVisible(face, canvasSize))
    );
    overlayDrawer(
      context,
      preparedFrame,
      state.currentFrame,
      placements,
      DEFAULT_RENDERING_PROFILE.overlayScale
    );
  }

  function renderLiveFrame() {
    const sourceSize = {
      width: elements.video.videoWidth,
      height: elements.video.videoHeight
    };
    if (!sourceSize.width || !sourceSize.height) return;
    const renderingProfile = getCameraRenderingProfile();
    liveCompositionDrawer({
      context,
      source: elements.video,
      sourceSize,
      canvasSize: { width: canvas.width, height: canvas.height },
      faces: state.liveFaces,
      preparedFrame: getPreparedFrame(renderingProfile.maskScale),
      frame: state.currentFrame,
      overlayScale: renderingProfile.overlayScale,
      overlayDrawer
    });
  }

  function isCameraActive() {
    return ['live', 'countdown'].includes(cameraSession.getState().status);
  }

  function startLiveLoop() {
    stopLiveLoop();
    if (!playbackReady || !isCameraActive()) return;
    if (!elements.video.videoWidth || !elements.video.videoHeight) return;
    lastDetectionAt = -Infinity;
    const generation = ++liveGeneration;
    const tick = timestamp => {
      if (generation !== liveGeneration || !isCameraActive()) return;
      if (elements.video.readyState >= 2) {
        renderLiveFrame();
        if (!liveDetectionUnavailable && timestamp - lastDetectionAt >= 100) {
          lastDetectionAt = timestamp;
          liveDetector.detectFacesForVideo(elements.video, timestamp)
            .then(faces => {
              if (generation === liveGeneration && isCameraActive()) state.liveFaces = faces;
            })
            .catch(() => {
              if (generation !== liveGeneration) return;
              liveDetectionUnavailable = true;
              elements.faceStatus.textContent = '실시간 프레임 인식을 사용할 수 없어요.';
              elements.retryDetectionBtn.hidden = false;
            });
        }
      }
      renderFrameId = requestAnimationFrameRef(tick);
    };
    renderFrameId = requestAnimationFrameRef(tick);
  }

  function stopLiveLoop() {
    liveGeneration += 1;
    if (renderFrameId !== null) cancelAnimationFrameRef(renderFrameId);
    renderFrameId = null;
  }

  function handleCameraChange(camera) {
    if (['starting', 'error', 'review', 'idle'].includes(camera.status)) {
      invalidatePlayback();
    }
    elements.countdown.hidden = camera.status !== 'countdown';
    elements.countdown.textContent = camera.remaining ?? '';
    elements.resultArea.hidden = camera.status !== 'review';
    elements.framePicker.hidden = camera.status === 'review';
    updateCaptureControls();
    elements.photoInput.disabled = camera.status === 'countdown';
    Array.from(elements.frameGrid.children).forEach(item => {
      item.disabled = camera.status === 'countdown';
    });

    if (camera.status === 'starting') {
      elements.cameraStatus.textContent = '카메라를 준비하는 중…';
    }
    if (camera.status === 'live') {
      startPlayback(camera.stream);
    }
    if (camera.status === 'error') {
      elements.cameraStatus.textContent = '카메라를 사용할 수 없어요. 사진을 업로드해주세요.';
      stopLiveLoop();
    }
    if (camera.status === 'review') {
      elements.cameraStatus.textContent = '';
      stopLiveLoop();
    }
    if (camera.status === 'idle') {
      elements.cameraStatus.textContent = '';
    }
    updateDownloadAvailability();
  }

  function toggleTimer() {
    if (cameraSession.getState().status !== 'live' || !playbackReady) return;
    const currentIndex = TIMER_OPTIONS.indexOf(state.timerSeconds);
    state.timerSeconds = TIMER_OPTIONS[(currentIndex + 1) % TIMER_OPTIONS.length];
    updateTimerControl();
  }

  function updateTimerControl() {
    const label = state.timerSeconds === 0 ? '끔' : `${state.timerSeconds}초`;
    elements.timerValue.textContent = label;
    elements.timerBtn.setAttribute('aria-label', `타이머: ${label}`);
    elements.timerBtn.setAttribute('aria-pressed', String(state.timerSeconds !== 0));
  }

  function startCapture() {
    if (cameraSession.getState().status !== 'live' || !playbackReady) return;
    uploadRequestGeneration += 1;
    cameraSession.capture(state.timerSeconds);
  }

  function captureLiveComposition() {
    uploadRequestGeneration += 1;
    renderLiveFrame();
    state.currentPhoto = null;
    stopLiveLoop();
  }

  function retryDetection() {
    if (cameraSession.getState().status === 'live' && liveDetectionUnavailable) {
      liveDetector.reset();
      liveDetectionUnavailable = false;
      state.liveFaces = [];
      lastDetectionAt = -Infinity;
      elements.retryDetectionBtn.hidden = true;
      elements.faceStatus.textContent = '';
      return;
    }
    return faceSession.retry();
  }

  function retake() {
    uploadRequestGeneration += 1;
    state.currentPhoto = null;
    state.liveFaces = [];
    liveDetector.reset();
    liveDetectionUnavailable = false;
    lastDetectionAt = -Infinity;
    faceSession.reset();
    elements.photoInput.value = '';
    cameraSession.start();
  }

  function downloadPhoto() {
    if (elements.downloadBtn.disabled) return;
    const link = documentRef.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `gingging-photo-${new Date().getTime()}.png`;
    link.click();
  }

  function updateDownloadAvailability() {
    const camera = cameraSession.getState();
    if (camera.status !== 'review') {
      elements.downloadBtn.disabled = true;
      return;
    }
    if (!state.currentPhoto) {
      elements.downloadBtn.disabled = false;
      return;
    }
    const analysis = faceSession.getState();
    const faceSettled = ['ready', 'empty', 'error'].includes(analysis.status);
    elements.downloadBtn.disabled = !(analysis.photo === state.currentPhoto && faceSettled);
  }

  function initCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function renderCanvas() {
    if (isCameraActive()) renderLiveFrame();
    else renderPhoto();
  }

  function destroy() {
    uploadRequestGeneration += 1;
    invalidatePlayback();
    stopLiveLoop();
    cameraSession.destroy();
  }

  return {
    init,
    setPhoto,
    renderCanvas,
    destroy,
    getState: () => ({
      ...state,
      camera: cameraSession.getState(),
      analysis: faceSession.getState()
    })
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('load', () => createApp().init());
}
