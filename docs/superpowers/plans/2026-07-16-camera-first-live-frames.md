# Camera-First Live Frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the upload-first booth with an inline front-camera experience that tracks selected frames over faces in real time, supports an optional five-second timer, reviews and downloads the captured still, and preserves the photographed background.

**Architecture:** Keep MediaPipe still-image detection for upload fallback and add an independently cached video-mode detector for live placements. Put stream/countdown lifecycle in a testable camera session, mirror source pixels and face geometry through a focused renderer, and let `app.js` coordinate those boundaries with the DOM. Remove background segmentation from application readiness, rendering, assets, tests, and active documentation.

**Tech Stack:** Vanilla ES modules, HTML5 Canvas, MediaDevices/getUserMedia, requestAnimationFrame, MediaPipe Tasks Vision 0.10.35, Node.js built-in test runner.

## Global Constraints

- Request exactly `{ video: { facingMode: 'user' } }`.
- Keep the output canvas exactly `600×750` with CSS aspect ratio `4 / 5`.
- Timer values are exactly off and five seconds; default is off.
- Display `5`, `4`, `3`, `2`, `1`, then capture once.
- Detect at most ten faces with the existing local `assets/models/face_landmarker.task`.
- Keep MediaPipe pinned to `0.10.35`.
- Keep image data and landmarks inside the browser.
- Preserve the photographed background; never load or run person segmentation.

## File map

- Create `js/camera-renderer.js` and `tests/camera-renderer.test.mjs` for mirrored cover drawing and face mapping.
- Modify `js/face-detection.js` and its tests for a dedicated `VIDEO` landmarker.
- Create `js/camera-session.js` and `tests/camera-session.test.mjs` for stream, timer, capture, review, and teardown state.
- Modify `index.html`, `css/styles.css`, and `tests/styles.test.cjs` for the camera shell, horizontal frame rail, shutter, timer, and review controls.
- Rewrite `js/app.js` integration and `tests/app.test.mjs`.
- Remove background source/tests/model and update `README.md`, `PROJECT_STRUCTURE.md`, `QUICKSTART.md`, and `tests/model-asset.test.cjs`.

---

### Task 1: Mirrored camera renderer

**Files:**
- Create: `js/camera-renderer.js`
- Create: `tests/camera-renderer.test.mjs`

**Interfaces:**
- Consumes: `getCoverTransform`, `mapPlacementToCanvas`, `isPlacementVisible`, `sortPlacementsForDrawing`, and `drawFrameOverlays`.
- Produces: `drawSourceCover`, `drawMirroredSourceCover`, `mapMirroredPlacementToCanvas`, and `drawLiveComposition`.

- [ ] **Step 1: Write the failing renderer tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  drawLiveComposition,
  drawMirroredSourceCover,
  drawSourceCover,
  mapMirroredPlacementToCanvas
} from '../js/camera-renderer.js';

function contextSpy() {
  const calls = [];
  return {
    calls,
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    drawImage: (...args) => calls.push(['drawImage', ...args]),
    restore: () => calls.push(['restore']),
    save: () => calls.push(['save']),
    scale: (...args) => calls.push(['scale', ...args]),
    translate: (...args) => calls.push(['translate', ...args])
  };
}

test('mirrors source pixels around the canvas width', () => {
  const context = contextSpy();
  const source = { id: 'video' };
  drawMirroredSourceCover(context, source, { width: 400, height: 500 }, { width: 400, height: 500 });
  assert.deepEqual(context.calls, [
    ['save'], ['translate', 400, 0], ['scale', -1, 1],
    ['drawImage', source, 0, 0, 400, 500], ['restore']
  ]);
});

test('mirrors face center and rotation while preserving size', () => {
  assert.deepEqual(
    mapMirroredPlacementToCanvas(
      { centerX: .25, centerY: .5, width: .2, height: .3, rotation: .15 },
      { width: 400, height: 500 },
      { width: 400, height: 500 }
    ),
    { centerX: 300, centerY: 250, width: 80, height: 150, rotation: -.15 }
  );
});

test('draws camera pixels before overlays', () => {
  const context = contextSpy();
  const overlays = [];
  drawLiveComposition({
    context,
    source: { id: 'video' },
    sourceSize: { width: 400, height: 500 },
    canvasSize: { width: 400, height: 500 },
    faces: [{ centerX: .25, centerY: .5, width: .2, height: .3, rotation: 0 }],
    preparedFrame: {},
    frame: {},
    overlayDrawer: (...args) => overlays.push(args)
  });
  assert.equal(context.calls[0][0], 'clearRect');
  assert.equal(context.calls.some(call => call[0] === 'drawImage'), true);
  assert.equal(overlays[0][3][0].centerX, 300);
});

test('draws uploaded sources without mirroring', () => {
  const context = contextSpy();
  const source = { id: 'photo' };
  drawSourceCover(context, source, { width: 400, height: 500 }, { width: 400, height: 500 });
  assert.deepEqual(context.calls, [['drawImage', source, 0, 0, 400, 500]]);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/camera-renderer.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/camera-renderer.js`.

- [ ] **Step 3: Implement the renderer**

```js
import {
  getCoverTransform,
  isPlacementVisible,
  mapPlacementToCanvas,
  sortPlacementsForDrawing
} from './face-geometry.js';
import { drawFrameOverlays } from './frame-overlay.js';

export function drawSourceCover(context, source, sourceSize, canvasSize) {
  const transform = getCoverTransform(sourceSize, canvasSize);
  context.drawImage(
    source,
    transform.offsetX,
    transform.offsetY,
    sourceSize.width * transform.scale,
    sourceSize.height * transform.scale
  );
}

export function drawMirroredSourceCover(context, source, sourceSize, canvasSize) {
  context.save();
  context.translate(canvasSize.width, 0);
  context.scale(-1, 1);
  drawSourceCover(context, source, sourceSize, canvasSize);
  context.restore();
}

export function mapMirroredPlacementToCanvas(placement, sourceSize, canvasSize) {
  const mapped = mapPlacementToCanvas(placement, sourceSize, canvasSize);
  return { ...mapped, centerX: canvasSize.width - mapped.centerX, rotation: -mapped.rotation };
}

export function drawLiveComposition({
  context,
  source,
  sourceSize,
  canvasSize,
  faces = [],
  preparedFrame = null,
  frame = null,
  overlayDrawer = drawFrameOverlays
}) {
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  drawMirroredSourceCover(context, source, sourceSize, canvasSize);
  if (!preparedFrame || !frame) return;
  const placements = sortPlacementsForDrawing(
    faces
      .map(face => mapMirroredPlacementToCanvas(face, sourceSize, canvasSize))
      .filter(face => isPlacementVisible(face, canvasSize))
  );
  overlayDrawer(context, preparedFrame, frame, placements);
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test tests/camera-renderer.test.mjs tests/face-geometry.test.mjs tests/frame-overlay.test.mjs`

Expected: all tests PASS.

```bash
git add js/camera-renderer.js tests/camera-renderer.test.mjs
git commit -m "feat(camera): add mirrored preview renderer"
```

---

### Task 2: MediaPipe video face detector

**Files:**
- Modify: `js/face-detection.js`
- Modify: `tests/face-detection.test.mjs`

**Interfaces:**
- Produces: `createLiveFaceDetectionService(options)` returning `detectFacesForVideo(video, timestamp)` and `reset()`.

- [ ] **Step 1: Add failing VIDEO-mode tests**

```js
import { createLiveFaceDetectionService } from '../js/face-detection.js';

test('creates a VIDEO landmarker and converts detectForVideo results', async () => {
  const optionsSeen = [];
  const moduleLoader = async () => ({
    FilesetResolver: { forVisionTasks: async () => 'vision' },
    FaceLandmarker: {
      createFromOptions: async (vision, options) => {
        optionsSeen.push(options);
        return { detectForVideo: () => ({ faceLandmarks: [validLandmarks()] }) };
      }
    }
  });
  const service = createLiveFaceDetectionService({ moduleLoader, wasmRoot: '/wasm', modelAssetPath: '/model' });
  assert.equal((await service.detectFacesForVideo({}, 123)).length, 1);
  assert.equal(optionsSeen[0].runningMode, 'VIDEO');
  assert.equal(optionsSeen[0].numFaces, 10);
});

test('does not overlap video inference', async () => {
  let resolveDetection;
  let calls = 0;
  const moduleLoader = async () => ({
    FilesetResolver: { forVisionTasks: async () => 'vision' },
    FaceLandmarker: {
      createFromOptions: async () => ({
        detectForVideo() {
          calls += 1;
          return new Promise(resolve => { resolveDetection = resolve; });
        }
      })
    }
  });
  const service = createLiveFaceDetectionService({ moduleLoader });
  const first = service.detectFacesForVideo({}, 100);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(await service.detectFacesForVideo({}, 101), []);
  assert.equal(calls, 1);
  resolveDetection({ faceLandmarks: [validLandmarks()] });
  assert.equal((await first).length, 1);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/face-detection.test.mjs`

Expected: FAIL because `createLiveFaceDetectionService` is not exported.

- [ ] **Step 3: Implement the video detector and share option/result helpers**

```js
function landmarkerOptions(runningMode, modelAssetPath) {
  return {
    baseOptions: { modelAssetPath },
    runningMode,
    numFaces: 10,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  };
}

function placementsFromResult(result) {
  return (result.faceLandmarks ?? []).slice(0, 10).map(landmarksToPlacement).filter(Boolean);
}

export function createLiveFaceDetectionService({
  moduleLoader = () => import(MEDIAPIPE_MODULE_URL),
  wasmRoot = MEDIAPIPE_WASM_ROOT,
  modelAssetPath = FACE_MODEL_URL
} = {}) {
  let detectorPromise = null;
  let inFlight = null;
  let latestFaces = [];

  async function getDetector() {
    if (!detectorPromise) {
      const initialization = (async () => {
        const { FilesetResolver, FaceLandmarker } = await moduleLoader();
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        return FaceLandmarker.createFromOptions(vision, landmarkerOptions('VIDEO', modelAssetPath));
      })();
      detectorPromise = initialization;
      try { return await initialization; }
      catch (error) {
        if (detectorPromise === initialization) detectorPromise = null;
        throw error;
      }
    }
    return detectorPromise;
  }

  return {
    async detectFacesForVideo(video, timestamp) {
      if (inFlight) return latestFaces;
      const detection = (async () => {
        const detector = await getDetector();
        latestFaces = placementsFromResult(await detector.detectForVideo(video, timestamp));
        return latestFaces;
      })();
      inFlight = detection;
      try { return await detection; }
      finally { if (inFlight === detection) inFlight = null; }
    },
    reset() {
      detectorPromise = null;
      inFlight = null;
      latestFaces = [];
    }
  };
}
```

Refactor the existing image service to use `landmarkerOptions('IMAGE', modelAssetPath)` and `placementsFromResult(detector.detect(image))` without changing its public API or initialization race protection.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test tests/face-detection.test.mjs tests/photo-session.test.mjs`

Expected: all tests PASS; the image detector still uses `IMAGE`.

```bash
git add js/face-detection.js tests/face-detection.test.mjs
git commit -m "feat(camera): add live face detection"
```

---

### Task 3: Camera stream and five-second session

**Files:**
- Create: `js/camera-session.js`
- Create: `tests/camera-session.test.mjs`

**Interfaces:**
- Consumes injected `getUserMedia`, timer functions, `onCapture`, and `onChange`.
- Produces `start()`, `capture(delaySeconds)`, `enterReview()`, `destroy()`, and `getState()`.

- [ ] **Step 1: Write failing session tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCameraSession } from '../js/camera-session.js';

function streamSpy() {
  const track = { stops: 0, stop() { this.stops += 1; } };
  return { track, stream: { getTracks: () => [track] } };
}

test('requests the front camera and publishes live', async () => {
  const calls = [];
  const states = [];
  const { stream } = streamSpy();
  const session = createCameraSession({
    getUserMedia: async constraints => { calls.push(constraints); return stream; },
    onChange: state => states.push(state.status)
  });
  await session.start();
  assert.deepEqual(calls, [{ video: { facingMode: 'user' } }]);
  assert.deepEqual(states, ['starting', 'live']);
});

test('counts five through one, captures once, and enters review', async () => {
  const timers = [];
  const captures = [];
  const states = [];
  const { stream, track } = streamSpy();
  const session = createCameraSession({
    getUserMedia: async () => stream,
    setTimeoutRef: callback => { timers.push(callback); return timers.length; },
    clearTimeoutRef() {},
    onCapture: () => captures.push('capture'),
    onChange: state => states.push([state.status, state.remaining])
  });
  await session.start();
  session.capture(5);
  session.capture(5);
  for (let i = 0; i < 5; i += 1) timers[i]();
  assert.deepEqual(states.slice(-6), [
    ['countdown', 5], ['countdown', 4], ['countdown', 3],
    ['countdown', 2], ['countdown', 1], ['review', null]
  ]);
  assert.deepEqual(captures, ['capture']);
  assert.equal(track.stops, 1);
});

test('stops a stream that resolves after destroy', async () => {
  let resolveStream;
  const pending = new Promise(resolve => { resolveStream = resolve; });
  const { stream, track } = streamSpy();
  const session = createCameraSession({ getUserMedia: () => pending });
  const start = session.start();
  session.destroy();
  resolveStream(stream);
  await start;
  assert.equal(track.stops, 1);
  assert.equal(session.getState().status, 'idle');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/camera-session.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the state machine**

```js
export function createCameraSession({
  getUserMedia,
  setTimeoutRef = setTimeout,
  clearTimeoutRef = clearTimeout,
  onCapture = () => {},
  onChange = () => {}
}) {
  let generation = 0;
  let activeStream = null;
  let timerHandle = null;
  let state = { status: 'idle', stream: null, remaining: null, error: null };

  function publish(status, { stream = activeStream, remaining = null, error = null } = {}) {
    state = { status, stream, remaining, error };
    onChange(state);
  }
  function cancelTimer() {
    if (timerHandle !== null) clearTimeoutRef(timerHandle);
    timerHandle = null;
  }
  function stopStream() {
    if (!activeStream) return;
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
  function finishCapture() {
    if (!['live', 'countdown'].includes(state.status)) return;
    cancelTimer();
    onCapture();
    stopStream();
    publish('review', { stream: null });
  }
  function count(remaining) {
    publish('countdown', { remaining });
    timerHandle = setTimeoutRef(() => {
      timerHandle = null;
      if (state.status !== 'countdown') return;
      if (remaining === 1) finishCapture();
      else count(remaining - 1);
    }, 1000);
  }

  return {
    async start() {
      const request = ++generation;
      cancelTimer();
      stopStream();
      publish('starting', { stream: null });
      try {
        const stream = await getUserMedia({ video: { facingMode: 'user' } });
        if (request !== generation) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        activeStream = stream;
        publish('live');
      } catch (error) {
        if (request === generation) publish('error', { stream: null, error });
      }
    },
    capture(delaySeconds = 0) {
      if (state.status !== 'live') return;
      if (delaySeconds > 0) count(delaySeconds);
      else finishCapture();
    },
    enterReview() {
      generation += 1;
      cancelTimer();
      stopStream();
      publish('review', { stream: null });
    },
    destroy() {
      generation += 1;
      cancelTimer();
      stopStream();
      publish('idle', { stream: null });
    },
    getState() { return state; }
  };
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test tests/camera-session.test.mjs`

Expected: all tests PASS.

```bash
git add js/camera-session.js tests/camera-session.test.mjs
git commit -m "feat(camera): add capture session and timer"
```

---

### Task 4: Camera-first markup and responsive styles

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `tests/styles.test.cjs`

**Interfaces:**
- Retains IDs `canvas`, `video`, `photoInput`, `frameGrid`, `resultArea`, `downloadBtn`, `resetBtn`, `faceStatus`, and `retryDetectionBtn`.
- Adds IDs `cameraStatus`, `countdown`, `framePicker`, `timerBtn`, `timerValue`, and `shutterBtn`.

- [ ] **Step 1: Write failing HTML/CSS contract tests**

```js
test('places a horizontal frame rail above the shutter', () => {
  assert.match(html, /<main class="camera-app">[\s\S]*class="camera-stage"[\s\S]*id="frameGrid"[\s\S]*class="capture-controls"[\s\S]*id="shutterBtn"/);
  assert.doesNotMatch(html, /id="cameraBtn"/);
});

test('provides the accessible timer and countdown', () => {
  assert.match(html, /id="timerBtn"[^>]*aria-pressed="false"/);
  assert.match(html, /id="timerValue"[^>]*>끔</);
  assert.match(html, /id="countdown"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('uses a horizontal frame rail and circular shutter', () => {
  assert.match(css, /\.frame-rail\s*{[^}]*display:\s*flex[^}]*overflow-x:\s*auto[^}]*scroll-snap-type:\s*x\s+proximity/s);
  assert.match(css, /\.shutter-btn\s*{[^}]*width:\s*76px[^}]*height:\s*76px[^}]*border-radius:\s*50%/s);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/styles.test.cjs`

Expected: FAIL because the current page still uses a camera modal and two-column frame grid.

- [ ] **Step 3: Replace the main markup**

```html
<main class="camera-app">
  <section class="camera-card" aria-label="깅깅룸 카메라">
    <div class="camera-stage">
      <canvas id="canvas" width="600" height="750"></canvas>
      <div id="countdown" class="countdown" role="status" aria-live="polite" hidden></div>
      <p id="cameraStatus" class="camera-status" role="status" aria-live="polite"></p>
    </div>
    <video id="video" muted playsinline hidden></video>
    <div class="face-feedback">
      <p id="faceStatus" class="face-status" role="status" aria-live="polite"></p>
      <button id="retryDetectionBtn" class="text-btn" type="button" hidden>프레임 인식 다시 시도</button>
    </div>
    <section id="framePicker" class="frame-picker" aria-labelledby="frameTitle">
      <h2 id="frameTitle">프레임</h2>
      <div class="frame-rail" id="frameGrid"></div>
    </section>
    <div class="capture-controls">
      <label class="control-action upload-action">
        <input type="file" id="photoInput" accept="image/*" hidden>
        <span aria-hidden="true">▧</span><small>업로드</small>
      </label>
      <button id="shutterBtn" class="shutter-btn" type="button" aria-label="사진 촬영"><span></span></button>
      <button id="timerBtn" class="control-action timer-btn" type="button" aria-pressed="false">
        <span aria-hidden="true">◷</span><small id="timerValue">끔</small>
      </button>
    </div>
    <section class="result-area" id="resultArea" hidden>
      <button id="downloadBtn" class="btn-primary" type="button">다운로드</button>
      <button id="resetBtn" class="btn-secondary" type="button">다시 찍기</button>
    </section>
  </section>
</main>
```

- [ ] **Step 4: Replace two-column rules with these camera primitives**

```css
.camera-app { width: min(100%, 560px); margin: 0 auto; }
.camera-card { padding: 18px; border-radius: 28px; background: #fff; box-shadow: 0 20px 50px rgba(91, 24, 45, .18); }
.camera-stage { position: relative; overflow: hidden; aspect-ratio: 4 / 5; border-radius: 22px; background: #171217; }
#canvas { display: block; width: 100%; height: 100%; }
.countdown { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: clamp(5rem, 28vw, 9rem); font-weight: 800; text-shadow: 0 4px 24px #000; background: rgba(0, 0, 0, .12); }
.countdown[hidden] { display: none; }
.camera-status { position: absolute; left: 18px; right: 18px; bottom: 18px; color: #fff; text-align: center; text-shadow: 0 2px 8px #000; }
.frame-rail { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x proximity; padding: 4px 2px 12px; scrollbar-width: none; }
.frame-item { flex: 0 0 76px; width: 76px; aspect-ratio: 1; scroll-snap-align: center; border: 3px solid transparent; border-radius: 18px; background: #fff3f6; overflow: hidden; }
.frame-item[aria-pressed="true"] { border-color: #c41e3a; box-shadow: 0 0 0 3px rgba(196, 30, 58, .14); }
.frame-item img { width: 100%; height: 100%; object-fit: contain; }
.capture-controls { display: grid; grid-template-columns: 1fr 92px 1fr; align-items: center; margin-top: 4px; }
.shutter-btn { width: 76px; height: 76px; justify-self: center; border: 5px solid #fff; border-radius: 50%; background: #c41e3a; box-shadow: 0 0 0 3px #c41e3a; }
.control-action { min-width: 0; display: grid; place-items: center; gap: 3px; border: 0; background: transparent; color: #5c4a50; cursor: pointer; }
.result-area:not([hidden]) { display: flex; gap: 12px; margin-top: 18px; }
@media (max-width: 480px) {
  body { padding: 0; }
  header { padding: 18px 16px 10px; margin: 0; }
  .camera-card { border-radius: 0; padding: 12px; min-height: calc(100vh - 76px); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

Remove `.booth`, `.photo-section`, `.frame-section`, `.frame-grid`, sticky, and modal-oriented rules. Preserve the existing color palette, focus visibility, and generic primary/secondary button language.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test tests/styles.test.cjs`

Expected: all tests PASS.

```bash
git add index.html css/styles.css tests/styles.test.cjs
git commit -m "feat(ui): add camera-first capture layout"
```

---

### Task 5: App integration, timer controls, review, and upload fallback

**Files:**
- Modify: `js/app.js`
- Modify: `tests/app.test.mjs`

**Interfaces:**
- Consumes all interfaces from Tasks 1–4 and the existing still `createPhotoSession`.
- Produces `createApp(options)` with injectable media/timing/render dependencies and `getState()` exposing `camera`, `timerSeconds`, `selectedFrameId`, `currentPhoto`, and still `analysis`.

- [ ] **Step 1: Replace white-background integration tests with camera-first tests**

```js
test('starts the camera during init', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();
  assert.deepEqual(harness.mediaCalls, [{ video: { facingMode: 'user' } }]);
  assert.equal(harness.elements.video.srcObject, harness.stream);
});

test('changes live overlays without restarting the stream', async () => {
  const harness = makeAppHarness({ liveFaces: [{ centerX: .5, centerY: .5, width: .2, height: .3, rotation: 0 }] });
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[0].listeners.click();
  await harness.runAnimationFrame(100);
  await harness.runAnimationFrame(220);
  assert.equal(harness.mediaCalls.length, 1);
  assert.equal(harness.liveDetectorCalls.length, 1);
  assert.equal(harness.overlayCalls.length > 0, true);
});

test('runs the optional five-second countdown once', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();
  harness.elements.timerBtn.listeners.click();
  harness.elements.shutterBtn.listeners.click();
  assert.equal(harness.elements.countdown.textContent, '5');
  harness.fireTimers(4);
  assert.equal(harness.elements.resultArea.hidden, true);
  harness.fireTimers(1);
  assert.equal(harness.elements.resultArea.hidden, false);
  assert.equal(harness.streamTrack.stops, 1);
});

test('keeps uploaded source pixels and has no background state', async () => {
  const harness = makeAppHarness({ cameraError: new Error('denied') });
  harness.app.init();
  await harness.flushCamera();
  const photo = makeLoadedImage(800, 600);
  await harness.app.setPhoto(photo);
  assert.equal(harness.photoDraws.some(args => args[0] === photo), true);
  assert.equal('background' in harness.app.getState(), false);
});

test('retake preserves frame and timer', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[0].listeners.click();
  harness.elements.timerBtn.listeners.click();
  harness.elements.shutterBtn.listeners.click();
  harness.fireTimers(5);
  harness.elements.resetBtn.listeners.click();
  await harness.flushCamera();
  assert.equal(harness.mediaCalls.length, 2);
  assert.equal(harness.app.getState().selectedFrameId, FRAMES[0].id);
  assert.equal(harness.app.getState().timerSeconds, 5);
});

test('keeps the camera live and retries only live face detection after a detector error', async () => {
  const harness = makeAppHarness({ liveDetectorError: new Error('model failed') });
  harness.app.init();
  await harness.flushCamera();
  await harness.runAnimationFrame(100);
  assert.equal(harness.elements.retryDetectionBtn.hidden, false);
  harness.elements.retryDetectionBtn.listeners.click();
  assert.equal(harness.liveDetectorResets, 1);
  assert.equal(harness.mediaCalls.length, 1);
});

test('destroys camera resources on page teardown', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();
  harness.windowListeners.beforeunload();
  assert.equal(harness.streamTrack.stops, 1);
  assert.equal(harness.cancelledAnimationFrames.length, 1);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/app.test.mjs`

Expected: FAIL because the current app still waits for a camera button and background session.

- [ ] **Step 3: Rewrite `createApp` coordination**

Use these state and session bindings:

```js
const state = {
  currentPhoto: null,
  currentFrame: null,
  selectedFrameId: null,
  timerSeconds: 0,
  liveFaces: []
};
let renderFrameId = null;
let lastDetectionAt = -Infinity;
let liveGeneration = 0;

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
    if (state.selectedFrameId === frameId && isCameraActive()) renderLiveFrame();
  });
  initCanvas();
  cameraSession.start();
}

function toggleTimer() {
  if (cameraSession.getState().status !== 'live') return;
  state.timerSeconds = state.timerSeconds === 5 ? 0 : 5;
  elements.timerBtn.setAttribute('aria-pressed', String(state.timerSeconds === 5));
  elements.timerValue.textContent = state.timerSeconds === 5 ? '5초' : '끔';
}

function startCapture() {
  cameraSession.capture(state.timerSeconds);
}

function captureLiveComposition() {
  renderLiveFrame();
  state.currentPhoto = null;
  stopLiveLoop();
}

function retake() {
  state.currentPhoto = null;
  faceSession.reset();
  cameraSession.start();
}
```

`handleCameraChange(camera)` must set controls and copy exactly:

```js
elements.countdown.hidden = camera.status !== 'countdown';
elements.countdown.textContent = camera.remaining ?? '';
elements.resultArea.hidden = camera.status !== 'review';
elements.framePicker.hidden = camera.status === 'review';
elements.shutterBtn.disabled = camera.status !== 'live';
elements.timerBtn.disabled = camera.status !== 'live';
elements.photoInput.disabled = camera.status === 'countdown';
elements.frameGrid.children.forEach(item => { item.disabled = camera.status === 'countdown'; });

if (camera.status === 'starting') elements.cameraStatus.textContent = '카메라를 준비하는 중…';
if (camera.status === 'live') {
  elements.cameraStatus.textContent = '카메라 준비 완료';
  elements.video.srcObject = camera.stream;
  Promise.resolve(elements.video.play()).then(startLiveLoop);
}
if (camera.status === 'error') {
  elements.cameraStatus.textContent = '카메라를 사용할 수 없어요. 사진을 업로드해주세요.';
  stopLiveLoop();
}
if (camera.status === 'review') {
  elements.cameraStatus.textContent = '';
  stopLiveLoop();
}
```

Register `windowRef.addEventListener('beforeunload', destroy)` during init. `destroy()` must call `stopLiveLoop()` and `cameraSession.destroy()`. A live detector rejection must leave the render loop and stream active, reveal `retryDetectionBtn`, and show `실시간 프레임 인식을 사용할 수 없어요.` Clicking retry while live calls `liveDetector.reset()`, hides the retry button, clears the status, and allows the next throttled tick to detect again without calling `getUserMedia`.

The render loop must throttle detection to 100 ms and ignore stale results:

```js
function startLiveLoop() {
  stopLiveLoop();
  const generation = ++liveGeneration;
  const tick = timestamp => {
    if (generation !== liveGeneration || !isCameraActive()) return;
    if (elements.video.readyState >= 2) {
      renderLiveFrame();
      if (timestamp - lastDetectionAt >= 100) {
        lastDetectionAt = timestamp;
        liveDetector.detectFacesForVideo(elements.video, timestamp)
          .then(faces => {
            if (generation === liveGeneration && isCameraActive()) state.liveFaces = faces;
          })
          .catch(() => {
            if (generation === liveGeneration) elements.faceStatus.textContent = '실시간 프레임 인식을 사용할 수 없어요.';
          });
      }
    }
    renderFrameId = requestAnimationFrameRef(tick);
  };
  renderFrameId = requestAnimationFrameRef(tick);
}
```

`renderLiveFrame()` passes video dimensions, `state.liveFaces`, and the prepared current frame to `drawLiveComposition`. Uploaded photos call `cameraSession.enterReview()`, use `drawSourceCover` directly, then existing unmirrored face mapping and `overlayDrawer`; do not fill white or wait for a background state. Camera failure leaves the upload label enabled. Capture keeps the current canvas as review output, and download reads that same canvas. Upload decode callbacks retain the existing generation check so an older file read or image decode cannot replace a newer camera/upload action.

Render each frame as a native button:

```js
const frameItem = documentRef.createElement('button');
frameItem.type = 'button';
frameItem.className = 'frame-item';
frameItem.setAttribute('aria-pressed', 'false');
// On selection set every frame button false, then this button true.
```

- [ ] **Step 4: Run GREEN, full tests, and commit**

Run: `node --test tests/app.test.mjs tests/camera-session.test.mjs tests/camera-renderer.test.mjs tests/face-detection.test.mjs`

Expected: focused tests PASS.

Run: `npm test`

Expected: only obsolete background-specific expectations remain for Task 6; no camera test fails.

```bash
git add js/app.js tests/app.test.mjs
git commit -m "feat(app): integrate live camera capture"
```

---

### Task 6: Remove white-background feature, document, and verify

**Files:**
- Delete: `js/background-composite.js`, `js/background-segmentation.js`, `js/background-session.js`
- Delete: `tests/background-composite.test.mjs`, `tests/background-segmentation.test.mjs`, `tests/background-session.test.mjs`
- Delete: `assets/models/selfie_segmenter.tflite`
- Modify: `tests/model-asset.test.cjs`, `README.md`, `PROJECT_STRUCTURE.md`, `QUICKSTART.md`

**Interfaces:**
- Produces an active repository with no person-segmentation code path or white-background product claim.

- [ ] **Step 1: Add a failing no-background contract**

```js
test('does not integrate automatic white-background processing', () => {
  assert.doesNotMatch(appSource, /background-(?:composite|segmentation|session)/);
  assert.doesNotMatch(indexHtml, /backgroundStatus|retryBackgroundBtn|흰색 배경/);
  assert.doesNotMatch(appSource, /fillCanvasWhite|createPersonForeground|SelfieSegmenter/);
});
```

Remove every `selfie_segmenter.tflite` read and assertion from `tests/model-asset.test.cjs`, retaining the existing face model size and SHA-256 checks unchanged.

- [ ] **Step 2: Run RED**

Run: `node --test tests/app.test.mjs tests/model-asset.test.cjs`

Expected: the no-background app contract fails until all old imports/usages are removed.

- [ ] **Step 3: Delete obsolete files and replace active README copy**

```markdown
- 📷 **바로 시작되는 카메라** - 페이지에 들어오면 전면 카메라를 바로 준비
- 🎭 **실시간 프레임** - 선택한 캐릭터 프레임을 얼굴에 실시간으로 표시
- ⏱️ **5초 타이머** - 타이머를 켜고 여유 있게 촬영
- 🌿 **원본 배경 유지** - 촬영한 공간의 배경을 그대로 보존

### 카메라 촬영

1. 페이지에서 카메라 권한을 허용합니다.
2. 촬영 버튼 위에서 프레임을 고릅니다.
3. 필요하면 타이머를 `5초`로 켭니다.
4. 촬영 후 결과를 확인하고 다운로드하거나 다시 찍습니다.

카메라 권한을 사용할 수 없을 때는 사진 업로드로 프레임 합성을 계속할 수 있습니다.
사진과 얼굴 좌표는 브라우저 안에서만 처리되며 서버로 전송되지 않습니다.
```

Update the two structure guides to list `camera-session.js` and `camera-renderer.js`, omit background modules and the selfie model, and describe `app.js` as the camera-first coordinator. Historical files under `docs/superpowers/specs` remain unchanged.

- [ ] **Step 4: Run cleanup search and fresh verification**

Run: `rg -n "background-(composite|segmentation|session)|selfie_segmenter|자동 흰색 배경|배경 다시 시도" index.html js tests README.md PROJECT_STRUCTURE.md QUICKSTART.md`

Expected: no output.

Run: `npm test`

Expected: exit 0 and zero failed tests.

Run: `npm run build`

Expected: exit 0 with `Static site - no build needed`.

Run: `git diff --check`

Expected: exit 0 and no output.

- [ ] **Step 5: Commit cleanup and run browser acceptance**

```bash
git add -A js tests assets/models README.md PROJECT_STRUCTURE.md QUICKSTART.md
git commit -m "refactor(background): preserve original scenes"
```

Start `python -m http.server 8000` and verify desktop plus a mobile viewport:

```text
camera starts without a separate camera-button click
preview is mirrored and fills the 4:5 stage
selected frames follow face translation and rotation
frame rail scrolls horizontally above the shutter
timer displays 5, 4, 3, 2, 1 and captures once
review and downloaded PNG retain the photographed background
retake starts one new stream and keeps frame/timer preference
permission denial exposes a working upload fallback
```

After browser acceptance, rerun `npm test`, `npm run build`, `git diff --check`, and `git status --short`. If acceptance finds a defect, first add a focused failing regression test, then make the smallest fix and commit it with an English scoped conventional message.
