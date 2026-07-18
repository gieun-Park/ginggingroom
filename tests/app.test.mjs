import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createApp } from '../js/app.js';
import { FRAMES } from '../js/frame-config.js';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
const resultAreaMarkup = indexHtml.match(/<section class="result-area"[\s\S]*?<\/section>/)?.[0] ?? '';

class Element {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.attributes = new Map();
    this.hidden = false;
    this.disabled = false;
    this._textContent = '';
    this.style = {};
    this.readyState = 0;
    this.videoWidth = 0;
    this.videoHeight = 0;
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value)
    };
  }

  appendChild(child) { this.children.push(child); }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  removeEventListener(type, handler) {
    if (this.listeners[type] === handler) delete this.listeners[type];
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  set textContent(value) { this._textContent = String(value); }
  get textContent() { return this._textContent; }
  click() { this.clickCount = (this.clickCount ?? 0) + 1; }
  set innerHTML(value) { if (value === '') this.children = []; }
  get innerHTML() { return ''; }
}

function makeLoadedImage(width, height) {
  return { width, height, naturalWidth: width, naturalHeight: height };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function makeAppHarness({
  faces = [],
  faceError = null,
  liveFaces = [],
  liveDetectorError = null,
  liveDetectorPromise = null,
  liveDetectorOutcomes = null,
  cameraError = null,
  playPromise = null,
  playError = null,
  videoWidth = 1280,
  videoHeight = 720,
  videoReadyState = 2,
  zoomCapabilities = {},
  zoomSettings = {},
  zoomConstraintError = null,
  zoomConstraintPromise = null,
  availableFrames = FRAMES.slice(0, 2),
  windowRef: windowOverrides = {}
} = {}) {
  const ids = [
    'canvas', 'photoInput', 'frameGrid', 'framePicker', 'resultArea',
    'downloadBtn', 'resetBtn', 'video', 'faceStatus', 'retryDetectionBtn',
    'cameraStatus', 'countdown', 'timerBtn', 'timerValue', 'shutterBtn',
    'zoomControls', 'zoom05Btn', 'zoom08Btn', 'zoom1Btn'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  elements.resultArea.hidden = true;
  elements.retryDetectionBtn.hidden = true;
  elements.zoomControls.hidden = true;
  elements.video.readyState = videoReadyState;
  elements.video.videoWidth = videoWidth;
  elements.video.videoHeight = videoHeight;
  let playCalls = 0;
  elements.video.play = () => {
    playCalls += 1;
    if (playError) throw playError;
    return playPromise ?? Promise.resolve();
  };

  const canvasDraws = [];
  const context = {
    clearRect(...args) { canvasDraws.push({ kind: 'clear', args }); },
    fillRect(...args) { canvasDraws.push({ kind: 'fill', args }); },
    fillText() {},
    drawImage(...args) { canvasDraws.push({ kind: 'draw', args }); },
    set fillStyle(value) {},
    set font(value) {},
    set textAlign(value) {}
  };
  elements.canvas.width = 600;
  elements.canvas.height = 750;
  elements.canvas.getContext = () => context;
  elements.canvas.toDataURL = () => 'data:image/png;base64,PHOTO';

  const createdElements = [];
  const documentRef = {
    getElementById: id => elements[id],
    createElement: tagName => {
      const element = new Element();
      element.tagName = tagName;
      createdElements.push(element);
      return element;
    },
    querySelectorAll: selector => selector === '.frame-item' ? elements.frameGrid.children : [],
    body: new Element('body')
  };

  const zoomConstraintCalls = [];
  const streamTrack = {
    stops: 0,
    stop() { this.stops += 1; },
    getCapabilities() { return zoomCapabilities; },
    getSettings() { return zoomSettings; },
    async applyConstraints(constraints) {
      zoomConstraintCalls.push(constraints);
      if (zoomConstraintPromise) await zoomConstraintPromise;
      if (zoomConstraintError) throw zoomConstraintError;
    }
  };
  const stream = {
    getTracks: () => [streamTrack],
    getVideoTracks: () => [streamTrack]
  };
  const mediaCalls = [];
  const windowListeners = {};
  const timers = new Map();
  let nextTimerId = 1;
  const animationFrames = new Map();
  const cancelledAnimationFrames = [];
  let nextAnimationFrameId = 1;
  const windowRef = {
    navigator: {
      mediaDevices: {
        async getUserMedia(constraints) {
          mediaCalls.push(constraints);
          if (cameraError) throw cameraError;
          return stream;
        }
      }
    },
    setTimeout(callback) {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, handler) { windowListeners[type] = handler; },
    ...windowOverrides
  };

  const detectorCalls = [];
  let currentFaceError = faceError;
  const detector = {
    async detectFaces(photo) {
      detectorCalls.push(photo);
      if (currentFaceError) throw currentFaceError;
      return await faces;
    },
    reset() { currentFaceError = null; }
  };

  const liveDetectorCalls = [];
  let currentLiveDetectorError = liveDetectorError;
  let liveDetectorResets = 0;
  let liveDetectorAttempt = 0;
  const liveDetector = {
    async detectFacesForVideo(video, timestamp) {
      liveDetectorCalls.push({ video, timestamp });
      if (currentLiveDetectorError) throw currentLiveDetectorError;
      if (liveDetectorOutcomes) {
        const outcome = liveDetectorOutcomes[
          Math.min(liveDetectorAttempt, liveDetectorOutcomes.length - 1)
        ];
        liveDetectorAttempt += 1;
        if (outcome instanceof Error) throw outcome;
        return await outcome;
      }
      if (liveDetectorPromise) return await liveDetectorPromise;
      return liveFaces;
    },
    reset() {
      liveDetectorResets += 1;
      currentLiveDetectorError = null;
    }
  };

  const frameImages = new Map(
    availableFrames.map(frame => [frame.id, makeLoadedImage(480, 480)])
  );
  const photoDraws = [];
  const liveDraws = [];
  const overlayCalls = [];
  const framePrepareCalls = [];
  const app = createApp({
    documentRef,
    windowRef,
    detector,
    liveDetector,
    frameImages,
    framePreloader: () => {},
    framePreparer(frameImage, frame, options) {
      framePrepareCalls.push({ frameImage, frame, options });
      return {
        width: 480,
        height: 480,
        maskScale: options?.maskScale ?? 1
      };
    },
    sourceDrawer(contextArg, source, sourceSize, canvasSize) {
      photoDraws.push([source, sourceSize, canvasSize]);
      contextArg.drawImage(source, 0, 0);
    },
    liveCompositionDrawer(args) {
      liveDraws.push(args);
      args.context.drawImage(args.source, 0, 0);
    },
    overlayDrawer(contextArg, preparedFrame, frame, placements, overlayScale = 1) {
      overlayCalls.push({
        context: contextArg,
        preparedFrame,
        frame,
        placements,
        overlayScale
      });
    },
    requestAnimationFrameRef(callback) {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrameRef(id) {
      animationFrames.delete(id);
      cancelledAnimationFrames.push(id);
    }
  });

  async function flushCamera() {
    await flushPromises();
  }

  async function runAnimationFrame(timestamp) {
    const entry = animationFrames.entries().next().value;
    assert.ok(entry, 'expected a scheduled animation frame');
    const [id, callback] = entry;
    animationFrames.delete(id);
    callback(timestamp);
    await flushPromises();
  }

  function fireTimers(count) {
    for (let index = 0; index < count; index += 1) {
      const entry = timers.entries().next().value;
      assert.ok(entry, 'expected a scheduled timer');
      const [id, callback] = entry;
      timers.delete(id);
      callback();
    }
  }

  return {
    app,
    elements,
    stream,
    streamTrack,
    zoomConstraintCalls,
    mediaCalls,
    windowListeners,
    detectorCalls,
    liveDetectorCalls,
    get liveDetectorResets() { return liveDetectorResets; },
    get playCalls() { return playCalls; },
    get pendingAnimationFrames() { return animationFrames.size; },
    photoDraws,
    liveDraws,
    overlayCalls,
    framePrepareCalls,
    canvasDraws,
    createdElements,
    cancelledAnimationFrames,
    flushCamera,
    runAnimationFrame,
    fireTimers
  };
}

function makeDecodeWindow() {
  const readers = [];
  const images = [];

  class ControlledFileReader {
    constructor() { readers.push(this); }
    readAsDataURL(file) { this.file = file; }
  }

  class ControlledImage {
    constructor() {
      this.width = 640;
      this.height = 480;
      this.naturalWidth = 640;
      this.naturalHeight = 480;
      images.push(this);
    }
  }

  return { FileReader: ControlledFileReader, Image: ControlledImage, readers, images };
}

function selectUpload(elements, file) {
  elements.photoInput.files = file ? [file] : [];
  elements.photoInput.listeners.change({ target: elements.photoInput });
}

test('does not render an unused image in the retained-photo action area', () => {
  assert.doesNotMatch(resultAreaMarkup, /result-preview|resultImage|<img\b/);
});

test('does not retain dead result preview bindings or styles', () => {
  assert.doesNotMatch(appSource, /resultImage/);
  assert.doesNotMatch(stylesSource, /\.result-preview\b/);
});

test('does not integrate automatic white-background processing', () => {
  assert.doesNotMatch(appSource, /background-(?:composite|segmentation|session)/);
  assert.doesNotMatch(indexHtml, /backgroundStatus|retryBackgroundBtn|흰색 배경/);
  assert.doesNotMatch(appSource, /fillCanvasWhite|createPersonForeground|SelfieSegmenter/);
});

test('starts the camera during init', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();

  assert.deepEqual(harness.mediaCalls, [{ video: { facingMode: 'user' } }]);
  assert.equal(harness.elements.video.srcObject, harness.stream);
  assert.equal(harness.app.getState().camera.status, 'live');
});

test('shows only supported zoom choices and marks the active setting', async () => {
  const harness = makeAppHarness({
    zoomCapabilities: { zoom: { min: 0.5, max: 1, step: 0.1 } },
    zoomSettings: { zoom: 1 }
  });
  harness.app.init();
  await harness.flushCamera();

  assert.equal(harness.elements.zoomControls.hidden, false);
  assert.equal(harness.elements.zoom05Btn.hidden, false);
  assert.equal(harness.elements.zoom08Btn.hidden, false);
  assert.equal(harness.elements.zoom1Btn.hidden, false);
  assert.equal(harness.elements.zoom1Btn.getAttribute('aria-pressed'), 'true');

  await harness.elements.zoom08Btn.listeners.click();

  assert.deepEqual(
    harness.zoomConstraintCalls,
    [{ advanced: [{ zoom: 0.8 }] }]
  );
  assert.equal(harness.elements.zoom08Btn.getAttribute('aria-pressed'), 'true');
  assert.equal(harness.app.getState().preferredZoom, 0.8);
});

test('hides the zoom group when fewer than two choices are supported', async () => {
  const harness = makeAppHarness({
    zoomCapabilities: { zoom: { min: 1, max: 1, step: 0.1 } },
    zoomSettings: { zoom: 1 }
  });
  harness.app.init();
  await harness.flushCamera();

  assert.equal(harness.elements.zoomControls.hidden, true);
  assert.deepEqual(harness.app.getState().supportedZooms, [1]);
});

test('keeps the camera live and hides zoom after constraint failure', async () => {
  const harness = makeAppHarness({
    zoomCapabilities: { zoom: { min: 0.5, max: 1, step: 0.1 } },
    zoomSettings: { zoom: 1 },
    zoomConstraintError: new Error('unsupported')
  });
  harness.app.init();
  await harness.flushCamera();

  await harness.elements.zoom08Btn.listeners.click();

  assert.equal(harness.app.getState().camera.status, 'live');
  assert.equal(harness.streamTrack.stops, 0);
  assert.equal(harness.elements.zoomControls.hidden, true);
  assert.equal(
    harness.elements.cameraStatus.textContent,
    '이 기기에서는 카메라 배율을 바꿀 수 없어요.'
  );
});

test('ignores a zoom result after capture replaces the active stream state', async () => {
  const pendingZoom = deferred();
  const harness = makeAppHarness({
    zoomCapabilities: { zoom: { min: 0.5, max: 1, step: 0.1 } },
    zoomSettings: { zoom: 1 },
    zoomConstraintPromise: pendingZoom.promise
  });
  harness.app.init();
  await harness.flushCamera();

  const zoomChange = harness.elements.zoom08Btn.listeners.click();
  harness.elements.shutterBtn.listeners.click();
  pendingZoom.resolve();
  await zoomChange;

  assert.equal(harness.app.getState().camera.status, 'review');
  assert.equal(harness.app.getState().preferredZoom, null);
  assert.equal(harness.elements.zoomControls.hidden, true);
});

test('reapplies a preferred zoom on retake only when the new stream supports it', async () => {
  const harness = makeAppHarness({
    zoomCapabilities: { zoom: { min: 0.5, max: 1, step: 0.1 } },
    zoomSettings: { zoom: 1 }
  });
  harness.app.init();
  await harness.flushCamera();
  await harness.elements.zoom08Btn.listeners.click();
  harness.elements.shutterBtn.listeners.click();

  harness.elements.resetBtn.listeners.click();
  await harness.flushCamera();

  assert.deepEqual(harness.zoomConstraintCalls, [
    { advanced: [{ zoom: 0.8 }] },
    { advanced: [{ zoom: 0.8 }] }
  ]);
  assert.equal(harness.app.getState().preferredZoom, 0.8);
});

test('keeps capture unavailable until current video playback is drawable', async () => {
  const playback = deferred();
  const harness = makeAppHarness({ playPromise: playback.promise });
  harness.app.init();
  await harness.flushCamera();

  assert.equal(harness.elements.shutterBtn.disabled, true);
  assert.equal(harness.elements.timerBtn.disabled, true);
  assert.equal(harness.elements.cameraStatus.textContent, '카메라를 준비하는 중…');
  assert.equal(harness.pendingAnimationFrames, 0);

  harness.elements.timerBtn.listeners.click();
  harness.elements.shutterBtn.listeners.click();
  assert.equal(harness.app.getState().timerSeconds, 0);
  assert.equal(harness.app.getState().camera.status, 'live');
  assert.equal(harness.streamTrack.stops, 0);

  playback.resolve();
  await harness.flushCamera();
  assert.equal(harness.elements.shutterBtn.disabled, false);
  assert.equal(harness.elements.timerBtn.disabled, false);
  assert.equal(harness.elements.cameraStatus.textContent, '카메라 준비 완료');
  assert.equal(harness.pendingAnimationFrames, 1);
});

test('keeps zero-dimension playback unavailable until a drawable frame event', async () => {
  const harness = makeAppHarness({ videoWidth: 0, videoHeight: 0 });
  harness.app.init();
  await harness.flushCamera();

  assert.equal(harness.elements.shutterBtn.disabled, true);
  assert.equal(harness.elements.timerBtn.disabled, true);
  assert.equal(harness.pendingAnimationFrames, 0);
  assert.equal(typeof harness.elements.video.listeners.loadeddata, 'function');

  harness.elements.video.videoWidth = 1280;
  harness.elements.video.videoHeight = 720;
  harness.elements.video.listeners.loadeddata();

  assert.equal(harness.elements.shutterBtn.disabled, false);
  assert.equal(harness.elements.timerBtn.disabled, false);
  assert.equal(harness.pendingAnimationFrames, 1);
});

test('stops media and exposes upload fallback when video playback rejects', async () => {
  const playback = deferred();
  const harness = makeAppHarness({ playPromise: playback.promise });
  harness.app.init();
  await harness.flushCamera();

  playback.reject(new Error('autoplay denied'));
  await harness.flushCamera();

  assert.equal(harness.streamTrack.stops, 1);
  assert.equal(harness.app.getState().camera.status, 'idle');
  assert.equal(
    harness.elements.cameraStatus.textContent,
    '카메라를 사용할 수 없어요. 사진을 업로드해주세요.'
  );
  assert.equal(harness.elements.photoInput.disabled, false);
  assert.equal(harness.elements.shutterBtn.disabled, true);
  assert.equal(harness.pendingAnimationFrames, 0);
});

test('stops media and exposes upload fallback when video playback throws', async () => {
  const harness = makeAppHarness({ playError: new Error('play failed') });
  harness.app.init();
  await harness.flushCamera();

  assert.equal(harness.streamTrack.stops, 1);
  assert.equal(harness.app.getState().camera.status, 'idle');
  assert.equal(
    harness.elements.cameraStatus.textContent,
    '카메라를 사용할 수 없어요. 사진을 업로드해주세요.'
  );
  assert.equal(harness.elements.photoInput.disabled, false);
  assert.equal(harness.elements.shutterBtn.disabled, true);
  assert.equal(harness.pendingAnimationFrames, 0);
});

test('does not start playback loop after review supersedes pending playback', async () => {
  const playback = deferred();
  const harness = makeAppHarness({ playPromise: playback.promise });
  harness.app.init();
  await harness.flushCamera();

  await harness.app.setPhoto(makeLoadedImage(800, 600));
  playback.resolve();
  await harness.flushCamera();

  assert.equal(harness.app.getState().camera.status, 'review');
  assert.equal(harness.pendingAnimationFrames, 0);
  assert.equal(harness.elements.resultArea.hidden, false);
});

test('does not start playback loop after destroy supersedes pending playback', async () => {
  const playback = deferred();
  const harness = makeAppHarness({ playPromise: playback.promise });
  harness.app.init();
  await harness.flushCamera();

  harness.app.destroy();
  playback.resolve();
  await harness.flushCamera();

  assert.equal(harness.app.getState().camera.status, 'idle');
  assert.equal(harness.streamTrack.stops, 1);
  assert.equal(harness.pendingAnimationFrames, 0);
});

test('uses native pressed frame buttons and changes overlays without restarting media', async () => {
  const harness = makeAppHarness({
    liveFaces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }]
  });
  harness.app.init();
  await harness.flushCamera();

  const firstFrame = harness.elements.frameGrid.children[0];
  const secondFrame = harness.elements.frameGrid.children[1];
  assert.equal(firstFrame.tagName, 'button');
  assert.equal(firstFrame.type, 'button');
  assert.equal(firstFrame.getAttribute('aria-pressed'), 'false');

  firstFrame.listeners.click();
  await harness.runAnimationFrame(100);
  await harness.runAnimationFrame(150);

  assert.equal(firstFrame.getAttribute('aria-pressed'), 'true');
  assert.equal(secondFrame.getAttribute('aria-pressed'), 'false');
  assert.equal(harness.mediaCalls.length, 1);
  assert.equal(harness.liveDetectorCalls.length, 1);
  assert.equal(harness.liveDraws.some(call => call.frame?.id === FRAMES[0].id), true);
});

test('uses the balanced 80 percent frame profile only for mobile camera composition', async () => {
  const harness = makeAppHarness({
    liveFaces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }],
    windowRef: {
      matchMedia: query => ({ matches: query === '(max-width: 480px)' })
    }
  });
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[0].listeners.click();
  await harness.runAnimationFrame(100);

  assert.equal(harness.liveDraws.at(-1).overlayScale, 0.8);
  assert.equal(harness.liveDraws.at(-1).preparedFrame.maskScale, 1.1);
  assert.equal(harness.framePrepareCalls.at(-1).options.maskScale, 1.1);

  harness.elements.shutterBtn.listeners.click();
  assert.equal(harness.liveDraws.at(-1).overlayScale, 0.8);
});

test('uses frame 22 mobile mask override without changing frame scale', async () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-22');
  const harness = makeAppHarness({
    availableFrames: [frame],
    liveFaces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }],
    windowRef: {
      matchMedia: query => ({ matches: query === '(max-width: 480px)' })
    }
  });
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[21].listeners.click();
  await harness.runAnimationFrame(100);

  assert.equal(harness.liveDraws.at(-1).overlayScale, 0.8);
  assert.equal(harness.liveDraws.at(-1).preparedFrame.maskScale, 1);
  assert.equal(harness.framePrepareCalls.at(-1).options.maskScale, 1);
});

test('keeps uploaded photos at full frame scale on mobile viewports', async () => {
  const face = { centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 };
  const harness = makeAppHarness({
    faces: [face],
    cameraError: new Error('denied'),
    windowRef: {
      matchMedia: query => ({ matches: query === '(max-width: 480px)' })
    }
  });
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[0].listeners.click();

  await harness.app.setPhoto(makeLoadedImage(800, 600));

  assert.equal(harness.framePrepareCalls.at(-1).options.maskScale, 1);
  assert.equal(harness.overlayCalls.at(-1).overlayScale, 1);
});

test('caches normal and mobile prepared frame variants separately', async () => {
  const mediaQuery = { matches: true };
  const harness = makeAppHarness({
    windowRef: { matchMedia: () => mediaQuery }
  });
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[0].listeners.click();
  await harness.runAnimationFrame(100);
  mediaQuery.matches = false;
  await harness.runAnimationFrame(200);

  assert.deepEqual(
    harness.framePrepareCalls.map(call => call.options.maskScale),
    [1.1, 1]
  );
});

test('throttles live face detection to one request per 100 milliseconds', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();

  await harness.runAnimationFrame(100);
  await harness.runAnimationFrame(199);
  await harness.runAnimationFrame(200);

  assert.deepEqual(
    harness.liveDetectorCalls.map(call => call.timestamp),
    [100, 200]
  );
});

test('cycles the timer through off, 3, 5, and 7 seconds', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();

  for (const [seconds, text] of [[3, '3초'], [5, '5초'], [7, '7초'], [0, '끔']]) {
    harness.elements.timerBtn.listeners.click();
    assert.equal(harness.app.getState().timerSeconds, seconds);
    assert.equal(harness.elements.timerValue.textContent, text);
    assert.equal(
      harness.elements.timerBtn.getAttribute('aria-label'),
      `타이머: ${text}`
    );
    assert.equal(
      harness.elements.timerBtn.getAttribute('aria-pressed'),
      String(seconds !== 0)
    );
  }
});

test('runs the selected seven-second countdown once and locks mutable controls', async () => {
  const harness = makeAppHarness({
    zoomCapabilities: { zoom: { min: 0.5, max: 1, step: 0.1 } },
    zoomSettings: { zoom: 1 }
  });
  harness.app.init();
  await harness.flushCamera();
  harness.elements.timerBtn.listeners.click();
  harness.elements.timerBtn.listeners.click();
  harness.elements.timerBtn.listeners.click();

  harness.elements.shutterBtn.listeners.click();

  assert.equal(harness.elements.countdown.textContent, '7');
  assert.equal(harness.elements.countdown.hidden, false);
  assert.equal(harness.elements.photoInput.disabled, true);
  assert.equal(harness.elements.frameGrid.children.every(item => item.disabled), true);
  assert.equal(harness.elements.zoom05Btn.disabled, true);
  assert.equal(harness.elements.timerBtn.disabled, true);
  assert.equal(harness.elements.shutterBtn.disabled, true);
  assert.equal(harness.elements.resultArea.hidden, true);

  harness.fireTimers(6);
  assert.equal(harness.elements.resultArea.hidden, true);
  harness.fireTimers(1);
  assert.equal(harness.elements.resultArea.hidden, false);
  assert.equal(harness.streamTrack.stops, 1);
  assert.equal(harness.app.getState().camera.status, 'review');
});

test('captures the current composed canvas and downloads that same output', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();
  await harness.runAnimationFrame(100);
  const drawsBeforeCapture = harness.liveDraws.length;

  harness.elements.shutterBtn.listeners.click();
  harness.elements.downloadBtn.listeners.click();

  assert.equal(harness.liveDraws.length, drawsBeforeCapture + 1);
  assert.equal(harness.app.getState().currentPhoto, null);
  assert.equal(harness.elements.resultArea.hidden, false);
  const link = harness.createdElements.find(element => element.tagName === 'a');
  assert.equal(link.href, 'data:image/png;base64,PHOTO');
  assert.equal(link.download.startsWith('gingging-photo-'), true);
  assert.equal(link.clickCount, 1);
});

test('keeps uploaded source pixels and unmirrored still-image frame alignment', async () => {
  const face = { centerX: 0.25, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 };
  const harness = makeAppHarness({ faces: [face], cameraError: new Error('denied') });
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[0].listeners.click();
  const photo = makeLoadedImage(800, 600);

  await harness.app.setPhoto(photo);

  assert.equal(harness.photoDraws.some(args => args[0] === photo), true);
  assert.equal(harness.canvasDraws.some(call => call.kind === 'fill'), false);
  assert.equal(harness.overlayCalls.at(-1).placements[0].centerX, 50);
  assert.equal('background' in harness.app.getState(), false);
});

test('camera failure keeps upload fallback enabled', async () => {
  const harness = makeAppHarness({ cameraError: new Error('denied') });
  harness.app.init();
  await harness.flushCamera();

  assert.equal(
    harness.elements.cameraStatus.textContent,
    '카메라를 사용할 수 없어요. 사진을 업로드해주세요.'
  );
  assert.equal(harness.elements.photoInput.disabled, false);
  assert.equal(harness.elements.framePicker.hidden, false);
});

test('retake preserves frame and timer while starting a new stream', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[0].listeners.click();
  harness.elements.timerBtn.listeners.click();
  harness.elements.timerBtn.listeners.click();
  harness.elements.shutterBtn.listeners.click();
  harness.fireTimers(5);

  harness.elements.resetBtn.listeners.click();
  await harness.flushCamera();

  assert.equal(harness.mediaCalls.length, 2);
  assert.equal(harness.app.getState().selectedFrameId, FRAMES[0].id);
  assert.equal(harness.app.getState().timerSeconds, 5);
  assert.equal(harness.elements.frameGrid.children[0].getAttribute('aria-pressed'), 'true');
});

test('keeps media live and retries only live detection after detector failure', async () => {
  const harness = makeAppHarness({ liveDetectorError: new Error('model failed') });
  harness.app.init();
  await harness.flushCamera();
  await harness.runAnimationFrame(100);

  assert.equal(harness.elements.retryDetectionBtn.hidden, false);
  assert.equal(harness.elements.faceStatus.textContent, '실시간 프레임 인식을 사용할 수 없어요.');
  await harness.runAnimationFrame(220);
  assert.equal(harness.liveDetectorCalls.length, 1);

  harness.elements.retryDetectionBtn.listeners.click();
  assert.equal(harness.liveDetectorResets, 1);
  assert.equal(harness.mediaCalls.length, 1);
  assert.equal(harness.elements.retryDetectionBtn.hidden, true);
  assert.equal(harness.elements.faceStatus.textContent, '');
  await harness.runAnimationFrame(230);
  assert.equal(harness.liveDetectorCalls.length, 2);
});

test('ignores a stale live detector result after capture enters review', async () => {
  const liveDetection = deferred();
  const harness = makeAppHarness({ liveDetectorPromise: liveDetection.promise });
  harness.app.init();
  await harness.flushCamera();
  await harness.runAnimationFrame(100);

  harness.elements.shutterBtn.listeners.click();
  liveDetection.resolve([
    { centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }
  ]);
  await flushPromises();

  assert.deepEqual(harness.app.getState().liveFaces, []);
  assert.equal(harness.app.getState().camera.status, 'review');
});

test('retake restores live detection after a detector failure', async () => {
  const harness = makeAppHarness({ liveDetectorError: new Error('model failed') });
  harness.app.init();
  await harness.flushCamera();
  await harness.runAnimationFrame(100);
  harness.elements.shutterBtn.listeners.click();

  harness.elements.resetBtn.listeners.click();
  await harness.flushCamera();
  await harness.runAnimationFrame(200);

  assert.equal(harness.liveDetectorResets, 1);
  assert.equal(harness.liveDetectorCalls.length, 2);
  assert.equal(harness.mediaCalls.length, 2);
  assert.equal(harness.elements.retryDetectionBtn.hidden, true);
});

test('retake resets live detection and rejects results from the prior camera session', async () => {
  const oldDetection = deferred();
  const newDetection = deferred();
  const oldFace = { centerX: 0.2, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 };
  const newFace = { centerX: 0.8, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 };
  const harness = makeAppHarness({
    liveDetectorOutcomes: [oldDetection.promise, newDetection.promise]
  });
  harness.app.init();
  await harness.flushCamera();
  await harness.runAnimationFrame(100);
  harness.elements.shutterBtn.listeners.click();

  harness.elements.resetBtn.listeners.click();
  await harness.flushCamera();
  await harness.runAnimationFrame(200);

  assert.equal(harness.liveDetectorResets, 1);
  oldDetection.resolve([oldFace]);
  await flushPromises();
  assert.deepEqual(harness.app.getState().liveFaces, []);
  newDetection.resolve([newFace]);
  await flushPromises();
  assert.deepEqual(harness.app.getState().liveFaces, [newFace]);
});

test('still-image detection failure keeps original pixels visible and can retry', async () => {
  const harness = makeAppHarness({ faceError: new Error('model failed'), cameraError: new Error('denied') });
  harness.app.init();
  await harness.flushCamera();
  const photo = makeLoadedImage(800, 600);

  await harness.app.setPhoto(photo);
  assert.equal(harness.photoDraws.some(args => args[0] === photo), true);
  assert.equal(harness.elements.retryDetectionBtn.hidden, false);
  assert.equal(harness.elements.faceStatus.textContent, '얼굴 인식을 불러오지 못했어요.');

  await harness.elements.retryDetectionBtn.listeners.click();
  assert.equal(harness.detectorCalls.length, 2);
  assert.equal(harness.elements.retryDetectionBtn.hidden, true);
});

test('destroys camera resources on page teardown', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();

  harness.windowListeners.beforeunload();

  assert.equal(harness.streamTrack.stops, 1);
  assert.equal(harness.cancelledAnimationFrames.length, 1);
  assert.equal(harness.app.getState().camera.status, 'idle');
});

test('keeps the newest upload when image decodes finish out of order', () => {
  const decodeWindow = makeDecodeWindow();
  const harness = makeAppHarness({ cameraError: new Error('denied'), windowRef: decodeWindow });
  harness.app.init();

  selectUpload(harness.elements, { name: 'a.png' });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });
  const imageA = decodeWindow.images[0];

  selectUpload(harness.elements, { name: 'b.png' });
  decodeWindow.readers[1].onload({ target: { result: 'data:image/png;base64,B' } });
  const imageB = decodeWindow.images[1];

  imageB.onload();
  imageA.onload();

  assert.equal(harness.app.getState().currentPhoto, imageB);
});

test('ignores an older upload whose file read finishes after a new selection', () => {
  const decodeWindow = makeDecodeWindow();
  const harness = makeAppHarness({ cameraError: new Error('denied'), windowRef: decodeWindow });
  harness.app.init();

  selectUpload(harness.elements, { name: 'a.png' });
  selectUpload(harness.elements, { name: 'b.png' });
  decodeWindow.readers[1].onload({ target: { result: 'data:image/png;base64,B' } });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });

  assert.equal(decodeWindow.images.length, 1);
  decodeWindow.images[0].onload();
  assert.equal(harness.app.getState().currentPhoto, decodeWindow.images[0]);
});

test('retake invalidates pending image decode and file read callbacks', async () => {
  const decodeWindow = makeDecodeWindow();
  const harness = makeAppHarness({ cameraError: new Error('denied'), windowRef: decodeWindow });
  harness.app.init();
  await harness.flushCamera();

  selectUpload(harness.elements, { name: 'decode.png' });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });
  const pendingImage = decodeWindow.images[0];
  harness.elements.resetBtn.listeners.click();
  pendingImage.onload();

  selectUpload(harness.elements, { name: 'read.png' });
  const pendingReader = decodeWindow.readers[1];
  harness.elements.resetBtn.listeners.click();
  pendingReader.onload({ target: { result: 'data:image/png;base64,B' } });

  assert.equal(decodeWindow.images.length, 1);
  assert.equal(harness.app.getState().currentPhoto, null);
});

test('an empty upload selection invalidates an older pending file read', () => {
  const decodeWindow = makeDecodeWindow();
  const harness = makeAppHarness({ cameraError: new Error('denied'), windowRef: decodeWindow });
  harness.app.init();

  selectUpload(harness.elements, { name: 'a.png' });
  selectUpload(harness.elements, null);
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });

  assert.equal(decodeWindow.images.length, 0);
  assert.equal(harness.app.getState().currentPhoto, null);
});

test('countdown capture invalidates a pending upload file read immediately', async () => {
  const decodeWindow = makeDecodeWindow();
  const harness = makeAppHarness({ windowRef: decodeWindow });
  harness.app.init();
  await harness.flushCamera();
  selectUpload(harness.elements, { name: 'pending-read.png' });

  harness.elements.timerBtn.listeners.click();
  harness.elements.shutterBtn.listeners.click();
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,UPLOAD' } });
  decodeWindow.images[0]?.onload();

  assert.equal(decodeWindow.images.length, 0);
  assert.equal(harness.app.getState().currentPhoto, null);
  assert.equal(harness.app.getState().camera.status, 'countdown');
  harness.fireTimers(3);
  assert.equal(harness.app.getState().camera.status, 'review');
  assert.equal(harness.streamTrack.stops, 1);
});

test('countdown capture invalidates a pending upload image decode immediately', async () => {
  const decodeWindow = makeDecodeWindow();
  const harness = makeAppHarness({ windowRef: decodeWindow });
  harness.app.init();
  await harness.flushCamera();
  selectUpload(harness.elements, { name: 'pending-decode.png' });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,UPLOAD' } });
  const pendingUpload = decodeWindow.images[0];

  harness.elements.timerBtn.listeners.click();
  harness.elements.shutterBtn.listeners.click();
  pendingUpload.onload();

  assert.equal(harness.app.getState().currentPhoto, null);
  assert.equal(harness.app.getState().camera.status, 'countdown');
  harness.fireTimers(3);
  assert.equal(harness.app.getState().camera.status, 'review');
  assert.equal(harness.streamTrack.stops, 1);
});

test('camera capture invalidates a pending upload decode', async () => {
  const decodeWindow = makeDecodeWindow();
  const harness = makeAppHarness({ windowRef: decodeWindow });
  harness.app.init();
  await harness.flushCamera();

  selectUpload(harness.elements, { name: 'upload.png' });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,UPLOAD' } });
  const pendingUpload = decodeWindow.images[0];
  harness.elements.shutterBtn.listeners.click();
  pendingUpload.onload();

  assert.equal(harness.app.getState().currentPhoto, null);
  assert.equal(harness.app.getState().camera.status, 'review');
});
