# Multi-Face Frame Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect up to ten faces in an uploaded or captured still image and apply the same selected character frame to every visible face with automatic position, scale, and eye-line rotation.

**Architecture:** Keep MediaPipe behind a lazy detection adapter, convert landmarks into a small `FacePlacement` contract, and keep all canvas calculations in pure geometry/overlay modules. Calibrate each existing frame with explicit face and mask anchors, cache detections per photo, and let the DOM app orchestrate status, retry, rendering, and download without rerunning detection when the selected frame changes.

**Tech Stack:** Vanilla JavaScript ES modules, HTML Canvas 2D, MediaPipe `@mediapipe/tasks-vision` 0.10.35, MediaPipe Face Landmarker float16 model, Node.js built-in test runner, static hosting.

## Global Constraints

- Process still images only; do not add live camera-preview tracking.
- Configure MediaPipe `numFaces: 10` and process at most ten returned faces.
- Apply one selected frame choice to every detected, visible face.
- Preserve the frame artwork aspect ratio; do not mesh-warp or independently stretch X and Y.
- Keep photos and landmarks in the browser; never send either to an application server.
- Run detection once per decoded photo and reuse placements when the frame changes.
- Preserve upload, camera capture, reset, frame selection, and PNG download flows.
- Do not claim that faces omitted above the ten-face limit are ranked by confidence.
- Use exact MediaPipe version `0.10.35`; do not use `latest` URLs.
- Keep `assets/models/face_landmarker.task` local to the deployed site.
- Preserve unrelated existing working-tree changes and stage only files named by each task.

## File Structure

- Create `js/face-geometry.js`: landmark-to-placement and image-to-canvas geometry only.
- Create `js/frame-config.js`: the 26 frame definitions and calibrated face/mask anchors.
- Create `js/frame-overlay.js`: frame-hole normalization and canvas overlay drawing only.
- Create `js/face-detection.js`: MediaPipe module/model initialization and still-image inference only.
- Create `js/photo-session.js`: async photo-analysis state, stale-result protection, retry, and reset.
- Modify `js/frames.js`: preload configured frame images and expose a module API.
- Modify `js/app.js`: DOM orchestration, camera/upload integration, status rendering, and canvas composition.
- Modify `index.html`: face-analysis status and retry controls; load the app as an ES module.
- Modify `css/styles.css`: analysis-state styling.
- Create `assets/models/face_landmarker.task`: pinned local MediaPipe model asset.
- Create `tests/face-geometry.test.mjs`, `tests/frame-config.test.mjs`, `tests/frame-overlay.test.mjs`, `tests/face-detection.test.mjs`, and `tests/photo-session.test.mjs`: focused unit coverage.
- Replace `tests/app.test.cjs` with `tests/app.test.mjs`: ES-module app integration coverage.
- Modify `README.md` and `FRAMES_CONFIG.md`: runtime behavior, privacy, model asset, and anchor maintenance.

---

### Task 1: Face placement and canvas geometry

**Files:**
- Create: `js/face-geometry.js`
- Create: `tests/face-geometry.test.mjs`

**Interfaces:**
- Consumes: MediaPipe face landmarks shaped as `Array<{x: number, y: number, z?: number}>`.
- Produces: `landmarksToPlacement(landmarks)`, `getCoverTransform(imageSize, canvasSize)`, `mapPlacementToCanvas(placement, imageSize, canvasSize)`, `isPlacementVisible(placement, canvasSize)`, and `sortPlacementsForDrawing(placements)`.

- [ ] **Step 1: Write the failing geometry tests**

```js
// tests/face-geometry.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FACE_OVAL_INDICES,
  getCoverTransform,
  isPlacementVisible,
  landmarksToPlacement,
  mapPlacementToCanvas,
  sortPlacementsForDrawing
} from '../js/face-geometry.js';

function makeLandmarks({ left = 0.3, right = 0.7, top = 0.2, bottom = 0.8, eyeRise = 0 }) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  FACE_OVAL_INDICES.forEach((index, position) => {
    const angle = (Math.PI * 2 * position) / FACE_OVAL_INDICES.length;
    landmarks[index] = {
      x: (left + right) / 2 + Math.cos(angle) * (right - left) / 2,
      y: (top + bottom) / 2 + Math.sin(angle) * (bottom - top) / 2,
      z: 0
    };
  });
  landmarks[33] = { x: 0.4, y: 0.4, z: 0 };
  landmarks[263] = { x: 0.6, y: 0.4 + eyeRise, z: 0 };
  return landmarks;
}

test('derives normalized center, bounds, and eye-line rotation', () => {
  const placement = landmarksToPlacement(makeLandmarks({ eyeRise: 0.1 }));
  assert.ok(Math.abs(placement.centerX - 0.5) < 0.001);
  assert.ok(Math.abs(placement.centerY - 0.5) < 0.001);
  assert.ok(Math.abs(placement.width - 0.4) < 0.001);
  assert.ok(Math.abs(placement.height - 0.6) < 0.001);
  assert.ok(Math.abs(placement.rotation - Math.atan2(0.1, 0.2)) < 0.001);
});

test('returns null for incomplete landmarks', () => {
  assert.equal(landmarksToPlacement([{ x: 0.5, y: 0.5 }]), null);
});

test('maps placements through the same cover transform used by the photo', () => {
  assert.deepEqual(getCoverTransform({ width: 1000, height: 500 }, { width: 400, height: 500 }), {
    scale: 1,
    offsetX: -300,
    offsetY: 0
  });
  assert.deepEqual(
    mapPlacementToCanvas(
      { centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.4, rotation: 0 },
      { width: 1000, height: 500 },
      { width: 400, height: 500 }
    ),
    { centerX: 200, centerY: 250, width: 200, height: 200, rotation: 0 }
  );
});

test('filters cropped faces and sorts larger faces before smaller faces', () => {
  assert.equal(isPlacementVisible({ centerX: -1, centerY: 20 }, { width: 400, height: 500 }), false);
  assert.equal(isPlacementVisible({ centerX: 20, centerY: 20 }, { width: 400, height: 500 }), true);
  assert.deepEqual(
    sortPlacementsForDrawing([
      { id: 'small', width: 20, height: 20 },
      { id: 'large', width: 40, height: 30 }
    ]).map(({ id }) => id),
    ['large', 'small']
  );
});
```

- [ ] **Step 2: Run the geometry tests and verify RED**

Run: `node --test tests/face-geometry.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/face-geometry.js`.

- [ ] **Step 3: Implement the pure geometry module**

```js
// js/face-geometry.js
export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

export function landmarksToPlacement(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length <= RIGHT_EYE_OUTER) return null;
  const oval = FACE_OVAL_INDICES.map(index => landmarks[index]);
  if (oval.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) return null;
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];
  if (![leftEye, rightEye].every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) return null;

  const xs = oval.map(point => point.x);
  const ys = oval.map(point => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
    rotation: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
  };
}

export function getCoverTransform(imageSize, canvasSize) {
  const scale = Math.max(canvasSize.width / imageSize.width, canvasSize.height / imageSize.height);
  return {
    scale,
    offsetX: (canvasSize.width - imageSize.width * scale) / 2,
    offsetY: (canvasSize.height - imageSize.height * scale) / 2
  };
}

export function mapPlacementToCanvas(placement, imageSize, canvasSize) {
  const transform = getCoverTransform(imageSize, canvasSize);
  return {
    centerX: placement.centerX * imageSize.width * transform.scale + transform.offsetX,
    centerY: placement.centerY * imageSize.height * transform.scale + transform.offsetY,
    width: placement.width * imageSize.width * transform.scale,
    height: placement.height * imageSize.height * transform.scale,
    rotation: placement.rotation
  };
}

export function isPlacementVisible(placement, canvasSize) {
  return placement.centerX >= 0 && placement.centerX <= canvasSize.width &&
    placement.centerY >= 0 && placement.centerY <= canvasSize.height;
}

export function sortPlacementsForDrawing(placements) {
  return [...placements].sort((a, b) => b.width * b.height - a.width * a.height);
}
```

- [ ] **Step 4: Run the geometry tests and verify GREEN**

Run: `node --test tests/face-geometry.test.mjs`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the geometry unit after execution authorization**

```bash
git add js/face-geometry.js tests/face-geometry.test.mjs
git commit -m "feat(face-geometry): map landmarks to canvas placements"
```

### Task 2: Frame calibration metadata

**Files:**
- Create: `js/frame-config.js`
- Create: `tests/frame-config.test.mjs`

**Interfaces:**
- Consumes: the 26 existing `assets/frames/frame_XX.png` files.
- Produces: `FRAMES`, where every entry has `id`, `name`, `src`, `faceAnchor`, `maskAnchors`, and `fitPadding`.

- [ ] **Step 1: Write the failing frame-config tests**

```js
// tests/frame-config.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { FRAMES } from '../js/frame-config.js';

function validAnchor(anchor) {
  return ['centerX', 'centerY', 'width', 'height']
    .every(key => Number.isFinite(anchor[key]) && anchor[key] > 0 && anchor[key] <= 1);
}

test('calibrates every existing frame with normalized face and mask anchors', () => {
  assert.equal(FRAMES.length, 26);
  assert.equal(new Set(FRAMES.map(frame => frame.id)).size, 26);
  FRAMES.forEach(frame => {
    assert.equal(validAnchor(frame.faceAnchor), true, frame.id);
    assert.ok(frame.maskAnchors.length >= 1, frame.id);
    frame.maskAnchors.forEach(anchor => assert.equal(validAnchor(anchor), true, frame.id));
    assert.equal(frame.fitPadding, 1.08);
  });
});

test('normalizes both face placeholders in frame 25', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-25');
  assert.equal(frame.maskAnchors.length, 2);
});
```

- [ ] **Step 2: Run the config tests and verify RED**

Run: `node --test tests/frame-config.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/frame-config.js`.

- [ ] **Step 3: Add the complete calibrated frame table**

```js
// js/frame-config.js
function anchorFromBox([left, top, right, bottom]) {
  return {
    centerX: (left + right) / 960,
    centerY: (top + bottom) / 960,
    width: (right - left) / 480,
    height: (bottom - top) / 480
  };
}

const DEFINITIONS = [
  ['frame-1', '프레임 1', 'frame_01.png', [180, 184, 299, 269]],
  ['frame-2', '프레임 2', 'frame_02.png', [196, 190, 303, 293]],
  ['frame-3', '프레임 3', 'frame_03.png', [160, 212, 313, 319]],
  ['frame-4', '프레임 4', 'frame_04.png', [185, 186, 280, 271]],
  ['frame-5', '프레임 5', 'frame_05.png', [168, 197, 310, 296]],
  ['frame-6', '프레임 6', 'frame_06.png', [139, 191, 256, 305]],
  ['frame-7', '프레임 7', 'frame_07.png', [203, 213, 304, 275]],
  ['frame-8', '프레임 8', 'frame_08.png', [188, 191, 290, 290]],
  ['frame-9', '프레임 9', 'frame_09.png', [168, 238, 314, 322]],
  ['frame-10', '프레임 10', 'frame_10.png', [171, 163, 299, 269]],
  ['frame-11', '프레임 11', 'frame_11.png', [143, 222, 274, 304]],
  ['frame-12', '프레임 12', 'frame_12.png', [184, 194, 288, 276]],
  ['frame-13', '프레임 13', 'frame_13.png', [203, 190, 267, 245]],
  ['frame-14', '프레임 14', 'frame_14.png', [213, 213, 258, 255]],
  ['frame-15', '프레임 15', 'frame_15.png', [217, 195, 276, 243]],
  ['frame-16', '프레임 16', 'frame_16.png', [223, 206, 264, 254]],
  ['frame-17', '프레임 17', 'frame_17.png', [225, 218, 258, 249]],
  ['frame-18', '프레임 18', 'frame_18.png', [218, 206, 260, 246]],
  ['frame-19', '프레임 19', 'frame_19.png', [215, 208, 263, 244]],
  ['frame-20', '프레임 20', 'frame_20.png', [210, 194, 248, 231]],
  ['frame-21', '프레임 21', 'frame_21.png', [219, 179, 260, 219]],
  ['frame-22', '프레임 22', 'frame_22.png', [210, 178, 263, 242]],
  ['frame-23', '프레임 23', 'frame_23.png', [246, 193, 290, 236]],
  ['frame-24', '프레임 24', 'frame_24.png', [216, 243, 252, 278]],
  ['frame-25', '프레임 25', 'frame_25.png', [148, 222, 191, 262], [[148, 222, 191, 262], [290, 197, 350, 257]]],
  ['frame-26', '프레임 26', 'frame_26.png', [210, 178, 269, 239]]
];

export const FRAMES = DEFINITIONS.map(([id, name, filename, faceBox, maskBoxes = [faceBox]]) => ({
  id,
  name,
  src: `assets/frames/${filename}`,
  faceAnchor: anchorFromBox(faceBox),
  maskAnchors: maskBoxes.map(anchorFromBox),
  fitPadding: 1.08
}));
```

- [ ] **Step 4: Run the config tests and verify GREEN**

Run: `node --test tests/frame-config.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Commit the frame metadata after execution authorization**

```bash
git add js/frame-config.js tests/frame-config.test.mjs
git commit -m "feat(frames): calibrate face opening anchors"
```

### Task 3: Transparent face masks and repeated frame drawing

**Files:**
- Create: `js/frame-overlay.js`
- Create: `tests/frame-overlay.test.mjs`

**Interfaces:**
- Consumes: a loaded frame image, one `FRAMES` entry, and canvas-mapped face placements.
- Produces: `prepareFrameImage(frameImage, frame, createCanvas)` and `drawFrameOverlays(ctx, preparedFrame, frame, placements)`.

- [ ] **Step 1: Write the failing overlay tests**

```js
// tests/frame-overlay.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { drawFrameOverlays, prepareFrameImage } from '../js/frame-overlay.js';

function makeContext() {
  const calls = [];
  return {
    calls,
    globalCompositeOperation: 'source-over',
    beginPath() { calls.push(['beginPath']); },
    ellipse(...args) { calls.push(['ellipse', ...args]); },
    fill() { calls.push(['fill', this.globalCompositeOperation]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    translate(...args) { calls.push(['translate', ...args]); },
    rotate(...args) { calls.push(['rotate', ...args]); },
    scale(...args) { calls.push(['scale', ...args]); }
  };
}

const frame = {
  faceAnchor: { centerX: 0.5, centerY: 0.4, width: 0.2, height: 0.2 },
  maskAnchors: [
    { centerX: 0.5, centerY: 0.4, width: 0.2, height: 0.2 },
    { centerX: 0.7, centerY: 0.4, width: 0.1, height: 0.1 }
  ],
  fitPadding: 1.08
};

test('erases every configured face placeholder in an offscreen canvas', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const prepared = prepareFrameImage(
    { naturalWidth: 480, naturalHeight: 480 },
    frame,
    () => canvas
  );
  assert.equal(prepared, canvas);
  assert.equal(context.calls.filter(([name]) => name === 'ellipse').length, 2);
  assert.equal(context.calls.filter(([name]) => name === 'fill')[0][1], 'destination-out');
});

test('draws one aspect-preserving transformed frame for every placement', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  drawFrameOverlays(context, prepared, frame, [
    { centerX: 100, centerY: 120, width: 40, height: 45, rotation: 0.1 },
    { centerX: 250, centerY: 220, width: 30, height: 35, rotation: -0.2 }
  ]);
  assert.equal(context.calls.filter(([name]) => name === 'drawImage').length, 2);
  const scales = context.calls.filter(([name]) => name === 'scale');
  scales.forEach(([, scaleX, scaleY]) => assert.equal(scaleX, scaleY));
});
```

- [ ] **Step 2: Run the overlay tests and verify RED**

Run: `node --test tests/frame-overlay.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/frame-overlay.js`.

- [ ] **Step 3: Implement masking and overlay transforms**

```js
// js/frame-overlay.js
export function prepareFrameImage(frameImage, frame, createCanvas = () => document.createElement('canvas')) {
  const canvas = createCanvas();
  canvas.width = frameImage.naturalWidth;
  canvas.height = frameImage.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-out';
  frame.maskAnchors.forEach(anchor => {
    context.beginPath();
    context.ellipse(
      anchor.centerX * canvas.width,
      anchor.centerY * canvas.height,
      anchor.width * canvas.width / 2,
      anchor.height * canvas.height / 2,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
  });
  context.globalCompositeOperation = 'source-over';
  return canvas;
}

export function drawFrameOverlays(context, preparedFrame, frame, placements) {
  const anchorX = frame.faceAnchor.centerX * preparedFrame.width;
  const anchorY = frame.faceAnchor.centerY * preparedFrame.height;
  const anchorWidth = frame.faceAnchor.width * preparedFrame.width;
  const anchorHeight = frame.faceAnchor.height * preparedFrame.height;

  placements.forEach(placement => {
    const scale = Math.max(
      placement.width * frame.fitPadding / anchorWidth,
      placement.height * frame.fitPadding / anchorHeight
    );
    context.save();
    context.translate(placement.centerX, placement.centerY);
    context.rotate(placement.rotation);
    context.scale(scale, scale);
    context.drawImage(preparedFrame, -anchorX, -anchorY);
    context.restore();
  });
}
```

- [ ] **Step 4: Run the overlay tests and verify GREEN**

Run: `node --test tests/frame-overlay.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Commit the overlay engine after execution authorization**

```bash
git add js/frame-overlay.js tests/frame-overlay.test.mjs
git commit -m "feat(frame-overlay): align masked frames to faces"
```

### Task 4: MediaPipe still-image detector and local model

**Files:**
- Create: `js/face-detection.js`
- Create: `tests/face-detection.test.mjs`
- Create: `tests/model-asset.test.cjs`
- Create: `assets/models/face_landmarker.task`

**Interfaces:**
- Consumes: `landmarksToPlacement()` from Task 1 and a decoded `HTMLImageElement` or canvas image source.
- Produces: `createFaceDetectionService(options)` returning `{ detectFaces(image), reset() }`.

- [ ] **Step 1: Write the failing detector tests with an injected MediaPipe module**

```js
// tests/face-detection.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { FACE_OVAL_INDICES } from '../js/face-geometry.js';
import { createFaceDetectionService } from '../js/face-detection.js';

function validLandmarks() {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  FACE_OVAL_INDICES.forEach((index, i) => {
    const angle = Math.PI * 2 * i / FACE_OVAL_INDICES.length;
    landmarks[index] = { x: 0.5 + Math.cos(angle) * 0.2, y: 0.5 + Math.sin(angle) * 0.3 };
  });
  landmarks[33] = { x: 0.4, y: 0.4 };
  landmarks[263] = { x: 0.6, y: 0.4 };
  return landmarks;
}

test('initializes MediaPipe once with the ten-face limit and reuses it', async () => {
  const calls = [];
  const detector = { detect: () => ({ faceLandmarks: [validLandmarks()] }) };
  const moduleLoader = async () => ({
    FilesetResolver: { forVisionTasks: async root => { calls.push(['wasm', root]); return 'vision'; } },
    FaceLandmarker: {
      createFromOptions: async (vision, options) => {
        calls.push(['create', vision, options]);
        return detector;
      }
    }
  });
  const service = createFaceDetectionService({ moduleLoader, wasmRoot: '/wasm', modelAssetPath: '/model.task' });
  assert.equal((await service.detectFaces({})).length, 1);
  assert.equal((await service.detectFaces({})).length, 1);
  assert.equal(calls.filter(([name]) => name === 'create').length, 1);
  assert.equal(calls.find(([name]) => name === 'create')[2].numFaces, 10);
});

test('clears a failed initialization so retry can succeed', async () => {
  let attempts = 0;
  const moduleLoader = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('load failed');
    return {
      FilesetResolver: { forVisionTasks: async () => 'vision' },
      FaceLandmarker: { createFromOptions: async () => ({ detect: () => ({ faceLandmarks: [] }) }) }
    };
  };
  const service = createFaceDetectionService({ moduleLoader, wasmRoot: '/wasm', modelAssetPath: '/model.task' });
  await assert.rejects(service.detectFaces({}), /load failed/);
  assert.deepEqual(await service.detectFaces({}), []);
  assert.equal(attempts, 2);
});
```

```js
// tests/model-asset.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('ships the local MediaPipe face landmarker model', () => {
  const stat = fs.statSync('assets/models/face_landmarker.task');
  assert.ok(stat.size > 1_000_000);
});
```

- [ ] **Step 2: Run the detector tests and verify RED**

Run: `node --test tests/face-detection.test.mjs tests/model-asset.test.cjs`

Expected: FAIL because `js/face-detection.js` and the local model do not exist.

- [ ] **Step 3: Implement lazy, retryable MediaPipe initialization**

```js
// js/face-detection.js
import { landmarksToPlacement } from './face-geometry.js';

export const MEDIAPIPE_VERSION = '0.10.35';
export const MEDIAPIPE_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`;
export const MEDIAPIPE_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const FACE_MODEL_URL = new URL('../assets/models/face_landmarker.task', import.meta.url).href;

export function createFaceDetectionService({
  moduleLoader = () => import(MEDIAPIPE_MODULE_URL),
  wasmRoot = MEDIAPIPE_WASM_ROOT,
  modelAssetPath = FACE_MODEL_URL
} = {}) {
  let detectorPromise = null;

  async function getDetector() {
    if (!detectorPromise) {
      detectorPromise = (async () => {
        const { FilesetResolver, FaceLandmarker } = await moduleLoader();
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath },
          runningMode: 'IMAGE',
          numFaces: 10,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false
        });
      })().catch(error => {
        detectorPromise = null;
        throw error;
      });
    }
    return detectorPromise;
  }

  return {
    async detectFaces(image) {
      const detector = await getDetector();
      return detector.detect(image).faceLandmarks
        .slice(0, 10)
        .map(landmarksToPlacement)
        .filter(Boolean);
    },
    reset() {
      detectorPromise = null;
    }
  };
}
```

- [ ] **Step 4: Download the pinned local face model**

Run:

```bash
mkdir -p assets/models
curl --fail --location --output assets/models/face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```

Expected: `assets/models/face_landmarker.task` exists and is larger than 1 MB. Network permission may be required.

- [ ] **Step 5: Run the detector tests and verify GREEN**

Run: `node --test tests/face-detection.test.mjs tests/model-asset.test.cjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 6: Commit the detection adapter and model after execution authorization**

```bash
git add js/face-detection.js tests/face-detection.test.mjs tests/model-asset.test.cjs assets/models/face_landmarker.task
git commit -m "feat(face-detection): add local multi-face landmarker"
```

### Task 5: Photo analysis state and stale-result protection

**Files:**
- Create: `js/photo-session.js`
- Create: `tests/photo-session.test.mjs`

**Interfaces:**
- Consumes: a detector with `detectFaces(image)` and `reset()`.
- Produces: `createPhotoSession({ detector, onChange })` returning `analyze(photo)`, `retry()`, `reset()`, and `getState()`.

- [ ] **Step 1: Write failing state-machine tests**

```js
// tests/photo-session.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhotoSession } from '../js/photo-session.js';

test('publishes loading and ready states and keeps at most ten faces', async () => {
  const states = [];
  const faces = Array.from({ length: 12 }, (_, index) => ({ index }));
  const session = createPhotoSession({
    detector: { detectFaces: async () => faces, reset() {} },
    onChange: state => states.push(state.status)
  });
  await session.analyze({ id: 'photo' });
  assert.deepEqual(states, ['loading', 'ready']);
  assert.equal(session.getState().faces.length, 10);
  assert.equal(session.getState().atLimit, true);
});

test('reports empty and error states while retaining the photo', async () => {
  const empty = createPhotoSession({ detector: { detectFaces: async () => [], reset() {} } });
  await empty.analyze({ id: 'empty-photo' });
  assert.equal(empty.getState().status, 'empty');
  assert.equal(empty.getState().photo.id, 'empty-photo');

  const failed = createPhotoSession({ detector: { detectFaces: async () => { throw new Error('no model'); }, reset() {} } });
  await failed.analyze({ id: 'failed-photo' });
  assert.equal(failed.getState().status, 'error');
  assert.equal(failed.getState().photo.id, 'failed-photo');
});

test('discards a stale result when a newer photo finishes first', async () => {
  const resolvers = new Map();
  const detector = { detectFaces: photo => new Promise(resolve => resolvers.set(photo.id, resolve)), reset() {} };
  const session = createPhotoSession({ detector });
  const first = session.analyze({ id: 'first' });
  const second = session.analyze({ id: 'second' });
  resolvers.get('second')([{ id: 'new-face' }]);
  await second;
  resolvers.get('first')([{ id: 'old-face' }]);
  await first;
  assert.equal(session.getState().photo.id, 'second');
  assert.equal(session.getState().faces[0].id, 'new-face');
});
```

- [ ] **Step 2: Run the session tests and verify RED**

Run: `node --test tests/photo-session.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/photo-session.js`.

- [ ] **Step 3: Implement the photo session**

```js
// js/photo-session.js
export function createPhotoSession({ detector, onChange = () => {} }) {
  let requestId = 0;
  let state = { status: 'idle', photo: null, faces: [], error: null, atLimit: false };

  function publish(next) {
    state = next;
    onChange(state);
  }

  async function analyze(photo) {
    const currentRequest = ++requestId;
    publish({ status: 'loading', photo, faces: [], error: null, atLimit: false });
    try {
      const detected = await detector.detectFaces(photo);
      if (currentRequest !== requestId) return;
      const faces = detected.slice(0, 10);
      publish({
        status: faces.length ? 'ready' : 'empty',
        photo,
        faces,
        error: null,
        atLimit: detected.length >= 10
      });
    } catch (error) {
      if (currentRequest !== requestId) return;
      publish({ status: 'error', photo, faces: [], error, atLimit: false });
    }
  }

  return {
    analyze,
    retry() {
      detector.reset();
      return state.photo ? analyze(state.photo) : Promise.resolve();
    },
    reset() {
      requestId += 1;
      publish({ status: 'idle', photo: null, faces: [], error: null, atLimit: false });
    },
    getState() {
      return state;
    }
  };
}
```

- [ ] **Step 4: Run the session tests and verify GREEN**

Run: `node --test tests/photo-session.test.mjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the state unit after execution authorization**

```bash
git add js/photo-session.js tests/photo-session.test.mjs
git commit -m "feat(photo-session): cache face analysis per photo"
```

### Task 6: Integrate detection, rendering, statuses, and existing flows

**Files:**
- Modify: `js/frames.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `css/styles.css`
- Replace: `tests/app.test.cjs` with `tests/app.test.mjs`

**Interfaces:**
- Consumes: `FRAMES`, `createFaceDetectionService()`, `createPhotoSession()`, geometry mapping, and overlay rendering from Tasks 1–5.
- Produces: the complete browser flow and a testable `createApp(dependencies)` entry point.

- [ ] **Step 1: Replace the legacy app test with failing ES-module integration tests**

```js
// tests/app.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../js/app.js';
import { FRAMES } from '../js/frame-config.js';

class Element {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.hidden = false;
    this.textContent = '';
    this.style = {};
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value)
    };
  }

  appendChild(child) { this.children.push(child); }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  set innerHTML(value) { if (value === '') this.children = []; }
  get innerHTML() { return ''; }
}

function makeLoadedImage(width, height) {
  return { width, height, naturalWidth: width, naturalHeight: height };
}

function makeAppHarness({ faces = [], error = null } = {}) {
  const ids = [
    'canvas', 'photoInput', 'cameraBtn', 'frameGrid', 'resultArea', 'resultImage',
    'downloadBtn', 'resetBtn', 'video', 'faceStatus', 'retryDetectionBtn'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const photoDraws = [];
  const context = {
    clearRect() {},
    fillRect() {},
    fillText() {},
    drawImage(...args) { photoDraws.push(args); },
    set fillStyle(value) {},
    set font(value) {},
    set textAlign(value) {}
  };
  elements.canvas.width = 400;
  elements.canvas.height = 500;
  elements.canvas.getContext = () => context;

  const documentRef = {
    getElementById: id => elements[id],
    createElement: () => new Element(),
    querySelectorAll: selector => selector === '.frame-item' ? elements.frameGrid.children : [],
    body: new Element('body')
  };
  const detectorCalls = [];
  const detector = {
    async detectFaces(photo) {
      detectorCalls.push(photo);
      if (error) throw error;
      return faces;
    },
    reset() {}
  };
  const frameImages = new Map(
    FRAMES.slice(0, 2).map(frame => [frame.id, makeLoadedImage(480, 480)])
  );
  const drawCalls = [];
  const app = createApp({
    documentRef,
    windowRef: { navigator: {}, addEventListener() {} },
    detector,
    frameImages,
    framePreloader: () => {},
    framePreparer: () => ({ width: 480, height: 480 }),
    overlayDrawer(contextArg, prepared, frame, placements) {
      placements.forEach(placement => drawCalls.push({ kind: 'overlay', frame, placement }));
    }
  });
  return { app, elements, drawCalls, detectorCalls, photoDraws };
}

test('draws one selected frame for every detected face and does not redetect on frame changes', async () => {
  const { app, elements, drawCalls, detectorCalls } = makeAppHarness({
    faces: [
      { centerX: 0.3, centerY: 0.4, width: 0.2, height: 0.3, rotation: 0 },
      { centerX: 0.7, centerY: 0.4, width: 0.2, height: 0.3, rotation: 0 }
    ]
  });
  app.init();
  await app.setPhoto(makeLoadedImage(1000, 500));
  elements.frameGrid.children[0].listeners.click();
  assert.equal(drawCalls.filter(call => call.kind === 'overlay').length, 2);
  elements.frameGrid.children[1].listeners.click();
  assert.equal(detectorCalls.length, 1);
});

test('keeps the photo visible and shows retry when detection fails', async () => {
  const { app, elements, photoDraws } = makeAppHarness({ error: new Error('model failed') });
  app.init();
  await app.setPhoto(makeLoadedImage(400, 500));
  assert.ok(photoDraws.length > 0);
  assert.equal(elements.faceStatus.textContent, '얼굴 인식을 불러오지 못했어요.');
  assert.equal(elements.retryDetectionBtn.hidden, false);
});

test('reset clears the cached analysis and status', async () => {
  const { app, elements } = makeAppHarness({ faces: [] });
  app.init();
  await app.setPhoto(makeLoadedImage(400, 500));
  elements.resetBtn.listeners.click();
  assert.equal(elements.faceStatus.textContent, '');
  assert.equal(app.getState().currentPhoto, null);
});
```

- [ ] **Step 2: Run the integration tests and verify RED**

Run: `node --test tests/app.test.mjs`

Expected: FAIL because `createApp` is not exported and the module flow is not wired.

- [ ] **Step 3: Convert frame preloading to an ES-module API**

```js
// js/frames.js
import { FRAMES } from './frame-config.js';

export { FRAMES };
export const loadedFrames = new Map();

export function preloadFrames(onFrameLoad = () => {}) {
  FRAMES.forEach(frame => {
    const image = new Image();
    image.onload = () => {
      loadedFrames.set(frame.id, image);
      onFrameLoad(frame.id);
    };
    image.onerror = () => console.warn(`Failed to load frame: ${frame.src}`);
    image.src = frame.src;
  });
}
```

- [ ] **Step 4: Add accessible analysis status and retry controls**

Insert immediately after `.preview-area` in `index.html`:

```html
<div class="face-feedback">
  <p id="faceStatus" class="face-status" role="status" aria-live="polite"></p>
  <button id="retryDetectionBtn" class="btn-secondary retry-detection" type="button" hidden>
    다시 시도
  </button>
</div>
```

Replace the two bottom scripts with:

```html
<script type="module" src="js/app.js"></script>
```

Add to `css/styles.css`:

```css
.face-feedback {
    min-height: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.face-status {
    flex: 1;
    color: #666;
    font-size: 0.95rem;
}

.retry-detection {
    flex: 0 0 auto;
    min-width: auto;
    padding: 8px 12px;
}
```

- [ ] **Step 5: Refactor `js/app.js` into an injectable module while preserving camera and download code**

Add these imports and app factory at the top of `js/app.js`:

```js
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
```

Create the session inside the factory and use these exact status messages:

```js
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
        ? (analysis.atLimit ? '얼굴은 최대 10명까지 적용할 수 있어요.' : `얼굴을 ${analysis.faces.length}명 찾았어요.`)
        : messages[analysis.status];
      elements.retryDetectionBtn.hidden = analysis.status !== 'error';
      renderCanvas();
    }
  });
```

Replace direct photo assignments in upload and camera capture with this shared operation:

```js
  async function setPhoto(image) {
    state.currentPhoto = image;
    renderCanvas();
    await session.analyze(image);
  }
```

Use the existing `cover` transform to draw the photo, then draw aligned overlays only for ready detections:

```js
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
    context.drawImage(state.currentPhoto, x, y, imageSize.width * scale, imageSize.height * scale);

    const analysis = session.getState();
    const frameImage = state.currentFrame && frameImages.get(state.currentFrame.id);
    if (analysis.status !== 'ready' || !frameImage) return;
    if (!preparedFrames.has(state.currentFrame.id)) {
      preparedFrames.set(state.currentFrame.id, framePreparer(frameImage, state.currentFrame));
    }
    const placements = sortPlacementsForDrawing(
      analysis.faces
        .map(face => mapPlacementToCanvas(face, imageSize, canvasSize))
        .filter(face => isPlacementVisible(face, canvasSize))
    );
    overlayDrawer(context, preparedFrames.get(state.currentFrame.id), state.currentFrame, placements);
  }
```

Wire `retryDetectionBtn` to `session.retry()`, call `session.reset()` and clear `preparedFrames` inside reset, and call `renderCanvas()` when the selected frame finishes preloading. Keep the existing upload decoding, camera modal, stream cleanup, PNG download, frame-grid selection classes, and initial canvas prompt inside the factory. Return the test surface:

```js
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
```

- [ ] **Step 6: Run integration and full unit tests**

Run: `npm test`

Expected: all legacy style tests and all new geometry, config, overlay, detector, session, asset, and app tests pass with 0 failures.

- [ ] **Step 7: Commit the integrated browser flow after execution authorization**

```bash
git add js/frames.js js/app.js index.html css/styles.css tests/app.test.mjs
git add -u tests/app.test.cjs
git commit -m "feat(app): apply selected frame to every detected face"
```

### Task 7: Browser acceptance, documentation, and final verification

**Files:**
- Modify: `README.md`
- Modify: `FRAMES_CONFIG.md`
- Verify: all feature files from Tasks 1–6

**Interfaces:**
- Consumes: the complete browser feature.
- Produces: documented maintenance instructions and fresh acceptance evidence.

- [ ] **Step 1: Document the user flow and privacy behavior in `README.md`**

Add a “다중 얼굴 자동 프레임” section stating:

```markdown
### 다중 얼굴 자동 프레임

1. 사진을 업로드하거나 카메라로 촬영합니다.
2. 브라우저가 사진 안의 얼굴을 최대 10명까지 분석합니다.
3. 프레임을 고르면 감지된 모든 얼굴에 같은 프레임이 자동 정렬됩니다.
4. 다른 프레임을 골라도 얼굴 분석 결과를 재사용하므로 바로 변경됩니다.

사진과 얼굴 좌표는 브라우저 안에서만 처리되며 애플리케이션 서버로 전송되지 않습니다.
얼굴이 정면을 향하고 서로 충분히 떨어진 사진에서 가장 자연스럽게 동작합니다.
```

- [ ] **Step 2: Document anchor maintenance in `FRAMES_CONFIG.md`**

Replace the obsolete offset-only guidance with the exact schema:

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

Explain that all values are normalized to the 480 by 480 source image, `faceAnchor` controls alignment, every `maskAnchor` is erased to transparency, and `fitPadding` adds breathing room around the detected face.

- [ ] **Step 3: Run fresh automated verification**

Run:

```bash
npm test
npm run build
```

Expected: both commands exit 0; the test output reports 0 failures.

- [ ] **Step 4: Run browser acceptance on the local static server**

Verify at 1100×800 and 360×800 viewports:

- A one-face photo shows `얼굴을 1명 찾았어요.` and one overlay.
- A multi-face photo draws one copy of the selected frame for each detected face, up to ten.
- Switching frames changes every overlay without another detector call.
- Frame 2, frame 4, frame 6, frame 21, frame 22, frame 24, frame 25, and frame 26 show the user's face instead of an opaque white placeholder.
- Frame 25 punches both source placeholders while aligning its left opening as specified.
- No-face input keeps the photo visible and shows the no-face message.
- A forced model-load failure keeps the photo visible and exposes a working retry button.
- Camera capture, reset, and PNG download still work.
- There are no browser console errors or failed model/frame requests.

- [ ] **Step 5: Inspect the final diff and working tree**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only files belonging to this feature and pre-existing unrelated user changes remain.

- [ ] **Step 6: Commit documentation after execution authorization**

```bash
git add README.md FRAMES_CONFIG.md
git commit -m "docs(face-frames): explain automatic multi-face alignment"
```
