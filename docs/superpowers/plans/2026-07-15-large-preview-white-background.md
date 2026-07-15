# Large Preview and Automatic White Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the left canvas a large, responsive live result preview and automatically replace the photographed environment with solid white for every uploaded or camera-captured still while retaining all segmented people and applying the same selected frame to every detected face.

**Architecture:** Add a lazy MediaPipe Image Segmenter adapter, a pure canvas-compositing boundary, and a stale-safe background session alongside the existing face session. The app accepts one original still, runs face detection and person segmentation once in parallel, caches the face placements and transparent foreground, then redraws only the cached composition when the selected frame changes.

**Tech Stack:** Vanilla JavaScript ES modules, HTML Canvas 2D, MediaPipe `@mediapipe/tasks-vision` 0.10.35, official float16 square SelfieSegmenter, Node.js built-in test runner, static hosting.

## Global Constraints

- Follow the approved design in `docs/superpowers/specs/2026-07-15-large-preview-white-background-design.md`.
- Process uploaded photos and captured camera stills only; do not segment the live camera preview.
- Automatically attempt person segmentation for every accepted still; do not add a background toggle.
- Keep all people represented by the model's person confidence mask, including multi-person photos.
- Keep the existing maximum of ten face overlays and apply one selected frame to every detected face.
- Run face detection and person segmentation against the original decoded still exactly once per accepted photo.
- Reuse cached face placements and the cached transparent foreground when frame selection changes.
- Render white only while segmentation is loading so the photographed environment never flashes before processing completes.
- On segmentation failure, render the original photo as a usable fallback and keep face overlays functional.
- Retry background removal independently; background retry must not invoke face detection.
- Copy MediaPipe mask data before closing every returned mask resource.
- Keep photos, landmarks, masks, foreground canvases, and downloads inside browser memory.
- Use exact MediaPipe runtime version `0.10.35` and keep both task models under `assets/models/`.
- Preserve upload decode generation guards, camera capture, reset, result controls, frame preload redraws, and PNG download.
- Preserve unrelated working-tree changes and stage only the files named by each task.

## File Structure

- Create `js/background-segmentation.js`: lazy ImageSegmenter initialization, local model configuration, copied person confidence masks, retry reset.
- Create `js/background-composite.js`: confidence-mask-to-transparent-foreground conversion and shared white/cover drawing helpers.
- Create `js/background-session.js`: per-photo background analysis state, foreground caching, retry, reset, and stale-result protection.
- Modify `js/app.js`: run face/background sessions for the same photo, render cached layers, update independent statuses, and reset both sessions.
- Modify `index.html`: add the background status/retry UI and change the output canvas to 600×750 logical pixels.
- Modify `css/styles.css`: emphasize and stick the preview on desktop, preserve single-column mobile flow, and style background feedback.
- Create `assets/models/selfie_segmenter.tflite`: official pinned float16 square SelfieSegmenter asset.
- Create `tests/background-segmentation.test.mjs`: adapter initialization, mask copying/closing, and initialization-race coverage.
- Create `tests/background-composite.test.mjs`: soft-alpha pixels, compositing operations, and cover transform coverage.
- Create `tests/background-session.test.mjs`: state, retry, stale completion, and reset-race coverage.
- Modify `tests/app.test.mjs`: app integration, render order, reuse, independent failure/retry, and reset coverage.
- Modify `tests/model-asset.test.cjs`: local segmentation-model size and SHA-256 integrity assertion.
- Modify `tests/styles.test.cjs`: large preview, desktop sticky layout, mobile reset, and narrow frame-grid contracts.
- Modify `README.md`: white-background behavior, privacy, model asset, and module map.

---

### Task 1: Local SelfieSegmenter adapter and model integrity

**Files:**
- Create: `js/background-segmentation.js`
- Create: `tests/background-segmentation.test.mjs`
- Create: `assets/models/selfie_segmenter.tflite`
- Modify: `tests/model-asset.test.cjs`

**Interfaces:**
- Consumes: a decoded still accepted by MediaPipe `ImageSegmenter.segment(image)`.
- Produces: `createBackgroundSegmentationService({ moduleLoader, wasmRoot, modelAssetPath })` with `segmentPeople(image)` and `reset()`.
- `segmentPeople(image)` resolves to `{ width: number, height: number, confidence: Float32Array }` for confidence-mask index 1.
- Exports: `SELFIE_SEGMENTER_MODEL_URL` resolving to `assets/models/selfie_segmenter.tflite`.

- [ ] **Step 1: Write failing adapter tests**

Create `tests/background-segmentation.test.mjs` with these exact cases:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SELFIE_SEGMENTER_MODEL_URL,
  createBackgroundSegmentationService
} from '../js/background-segmentation.js';
import { MEDIAPIPE_MODULE_URL, MEDIAPIPE_WASM_ROOT } from '../js/face-detection.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeRuntime({ floatData = new Float32Array([0, 0.25, 0.75, 1]) } = {}) {
  const calls = { wasmRoot: null, options: null, segments: 0, closes: [0, 0] };
  const masks = [0, 1].map(index => ({
    width: 2,
    height: 2,
    getAsFloat32Array: () => index === 1 ? floatData : new Float32Array(4),
    close: () => { calls.closes[index] += 1; }
  }));
  const segmenter = {
    segment() {
      calls.segments += 1;
      return { confidenceMasks: masks };
    }
  };
  const runtime = {
    FilesetResolver: {
      async forVisionTasks(wasmRoot) {
        calls.wasmRoot = wasmRoot;
        return { kind: 'vision' };
      }
    },
    ImageSegmenter: {
      async createFromOptions(vision, options) {
        assert.deepEqual(vision, { kind: 'vision' });
        calls.options = options;
        return segmenter;
      }
    }
  };
  return { calls, runtime };
}

test('uses the pinned runtime and local person-confidence model configuration', async () => {
  assert.equal(MEDIAPIPE_MODULE_URL.includes('@mediapipe/tasks-vision@0.10.35'), true);
  assert.equal(MEDIAPIPE_WASM_ROOT.includes('@mediapipe/tasks-vision@0.10.35/wasm'), true);
  assert.equal(SELFIE_SEGMENTER_MODEL_URL.endsWith('/assets/models/selfie_segmenter.tflite'), true);

  const { calls, runtime } = makeRuntime();
  const service = createBackgroundSegmentationService({ moduleLoader: async () => runtime });
  await service.segmentPeople({ id: 'photo' });
  await service.segmentPeople({ id: 'photo-2' });

  assert.equal(calls.wasmRoot, MEDIAPIPE_WASM_ROOT);
  assert.deepEqual(calls.options, {
    baseOptions: { modelAssetPath: SELFIE_SEGMENTER_MODEL_URL },
    runningMode: 'IMAGE',
    outputCategoryMask: false,
    outputConfidenceMasks: true
  });
  assert.equal(calls.segments, 2);
});

test('copies the person mask and closes every MediaPipe confidence mask', async () => {
  const floatData = new Float32Array([0, 0.25, 0.75, 1]);
  const { calls, runtime } = makeRuntime({ floatData });
  const service = createBackgroundSegmentationService({ moduleLoader: async () => runtime });
  const mask = await service.segmentPeople({ id: 'photo' });

  floatData[1] = 0.9;
  assert.deepEqual(mask, {
    width: 2,
    height: 2,
    confidence: new Float32Array([0, 0.25, 0.75, 1])
  });
  assert.deepEqual(calls.closes, [1, 1]);
});

test('a rejected old initialization cannot clear a newer initialization', async () => {
  const first = deferred();
  const second = deferred();
  const { runtime } = makeRuntime();
  const loads = [first.promise, second.promise];
  let loadCount = 0;
  const service = createBackgroundSegmentationService({
    moduleLoader: () => loads[loadCount++]
  });

  const oldRequest = service.segmentPeople({ id: 'old' });
  service.reset();
  const newRequest = service.segmentPeople({ id: 'new' });
  first.reject(new Error('old initialization failed'));
  second.resolve(runtime);

  await assert.rejects(oldRequest, /old initialization failed/);
  await newRequest;
  await service.segmentPeople({ id: 'reuse-new-initialization' });
  assert.equal(loadCount, 2);
});
```

- [ ] **Step 2: Run the adapter tests and verify RED**

Run: `node --test tests/background-segmentation.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/background-segmentation.js`.

- [ ] **Step 3: Implement the lazy segmentation service**

Create `js/background-segmentation.js`:

```js
import {
  MEDIAPIPE_MODULE_URL,
  MEDIAPIPE_WASM_ROOT
} from './face-detection.js';

export const SELFIE_SEGMENTER_MODEL_URL = new URL(
  '../assets/models/selfie_segmenter.tflite',
  import.meta.url
).href;

export function createBackgroundSegmentationService({
  moduleLoader = () => import(MEDIAPIPE_MODULE_URL),
  wasmRoot = MEDIAPIPE_WASM_ROOT,
  modelAssetPath = SELFIE_SEGMENTER_MODEL_URL
} = {}) {
  let segmenterPromise = null;

  async function getSegmenter() {
    if (!segmenterPromise) {
      const initialization = (async () => {
        const { FilesetResolver, ImageSegmenter } = await moduleLoader();
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        return ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath },
          runningMode: 'IMAGE',
          outputCategoryMask: false,
          outputConfidenceMasks: true
        });
      })();
      segmenterPromise = initialization;
      try {
        return await initialization;
      } catch (error) {
        if (segmenterPromise === initialization) segmenterPromise = null;
        throw error;
      }
    }
    return segmenterPromise;
  }

  return {
    async segmentPeople(image) {
      const segmenter = await getSegmenter();
      const result = segmenter.segment(image);
      const confidenceMasks = result.confidenceMasks ?? [];
      try {
        const personMask = confidenceMasks[1];
        if (!personMask) throw new Error('Person confidence mask is unavailable.');
        return {
          width: personMask.width,
          height: personMask.height,
          confidence: Float32Array.from(personMask.getAsFloat32Array())
        };
      } finally {
        confidenceMasks.forEach(mask => mask.close());
        result.categoryMask?.close();
      }
    },
    reset() {
      segmenterPromise = null;
    }
  };
}
```

- [ ] **Step 4: Run the adapter tests and verify GREEN**

Run: `node --test tests/background-segmentation.test.mjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Add a failing local-model integrity assertion**

Append this test to `tests/model-asset.test.cjs`:

```js
test('ships the pinned local MediaPipe selfie segmenter model', () => {
  const modelPath = 'assets/models/selfie_segmenter.tflite';
  const model = fs.readFileSync(modelPath);
  const stat = fs.statSync(modelPath);
  assert.equal(stat.size, 249_537);
  assert.equal(
    crypto.createHash('sha256').update(model).digest('hex'),
    '191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b'
  );
});
```

Run: `node --test tests/model-asset.test.cjs`

Expected: FAIL with `ENOENT` for `assets/models/selfie_segmenter.tflite`.

- [ ] **Step 6: Download and verify the official pinned model**

Run:

```bash
curl -fL https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite -o assets/models/selfie_segmenter.tflite
shasum -a 256 assets/models/selfie_segmenter.tflite
node --test tests/model-asset.test.cjs
```

Expected SHA-256: `191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b`.

Expected tests: 2 tests pass, 0 fail.

- [ ] **Step 7: Commit the segmentation boundary**

```bash
git add js/background-segmentation.js tests/background-segmentation.test.mjs tests/model-asset.test.cjs assets/models/selfie_segmenter.tflite
git commit -m "feat(background): add local person segmentation"
```

### Task 2: Soft-alpha foreground composition

**Files:**
- Create: `js/background-composite.js`
- Create: `tests/background-composite.test.mjs`

**Interfaces:**
- Consumes: an original photo and `{ width, height, confidence: Float32Array }`.
- Produces: `createPersonForeground(photo, mask, { createCanvas })`, returning a transparent canvas at the original photo dimensions.
- Exports: `fillCanvasWhite(context, canvasSize)` and `drawPhotoLayer(context, source, imageSize, canvasSize)` for deterministic app render order.

- [ ] **Step 1: Write failing compositing tests**

Create `tests/background-composite.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPersonForeground,
  drawPhotoLayer,
  fillCanvasWhite
} from '../js/background-composite.js';

function makeCanvasFactory() {
  const canvases = [];
  function createCanvas(width, height) {
    const operations = [];
    const context = {
      globalCompositeOperation: 'source-over',
      createImageData(imageWidth, imageHeight) {
        return {
          width: imageWidth,
          height: imageHeight,
          data: new Uint8ClampedArray(imageWidth * imageHeight * 4)
        };
      },
      putImageData(imageData, x, y) {
        operations.push({ kind: 'putImageData', imageData, x, y });
      },
      drawImage(...args) {
        operations.push({
          kind: 'drawImage',
          composite: this.globalCompositeOperation,
          args
        });
      }
    };
    const canvas = { width, height, context, operations, getContext: () => context };
    canvases.push(canvas);
    return canvas;
  }
  return { canvases, createCanvas };
}

test('turns confidence values into soft alpha and masks the original photo', () => {
  const factory = makeCanvasFactory();
  const photo = { width: 4, height: 2 };
  const foreground = createPersonForeground(
    photo,
    { width: 2, height: 2, confidence: new Float32Array([0, 0.25, 0.5, 1]) },
    { createCanvas: factory.createCanvas }
  );

  const maskImage = factory.canvases[0].operations[0].imageData;
  assert.deepEqual(
    [maskImage.data[3], maskImage.data[7], maskImage.data[11], maskImage.data[15]],
    [0, 64, 128, 255]
  );
  assert.equal(foreground, factory.canvases[1]);
  assert.deepEqual(factory.canvases[1].operations.map(operation => operation.composite), [
    'source-over',
    'destination-in'
  ]);
  assert.deepEqual(factory.canvases[1].operations[1].args.slice(1), [0, 0, 4, 2]);
});

test('fills white and maps a photo layer through the shared cover transform', () => {
  const operations = [];
  const context = {
    clearRect(...args) { operations.push(['clear', ...args]); },
    fillRect(...args) { operations.push(['fill', this.fillStyle, ...args]); },
    drawImage(...args) { operations.push(['draw', ...args]); },
    fillStyle: ''
  };
  const source = { id: 'foreground' };

  fillCanvasWhite(context, { width: 600, height: 750 });
  drawPhotoLayer(
    context,
    source,
    { width: 1000, height: 500 },
    { width: 600, height: 750 }
  );

  assert.deepEqual(operations, [
    ['clear', 0, 0, 600, 750],
    ['fill', '#fff', 0, 0, 600, 750],
    ['draw', source, -450, 0, 1500, 750]
  ]);
});
```

- [ ] **Step 2: Run the compositing tests and verify RED**

Run: `node --test tests/background-composite.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/background-composite.js`.

- [ ] **Step 3: Implement the compositing helpers**

Create `js/background-composite.js`:

```js
import { getCoverTransform } from './face-geometry.js';

function browserCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function alphaByte(confidence) {
  return Math.round(Math.max(0, Math.min(1, confidence)) * 255);
}

export function createPersonForeground(
  photo,
  mask,
  { createCanvas = browserCanvas } = {}
) {
  const maskCanvas = createCanvas(mask.width, mask.height);
  const maskContext = maskCanvas.getContext('2d');
  const maskImage = maskContext.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.confidence.length; index += 1) {
    const pixel = index * 4;
    maskImage.data[pixel] = 255;
    maskImage.data[pixel + 1] = 255;
    maskImage.data[pixel + 2] = 255;
    maskImage.data[pixel + 3] = alphaByte(mask.confidence[index]);
  }
  maskContext.putImageData(maskImage, 0, 0);

  const foreground = createCanvas(photo.width, photo.height);
  const context = foreground.getContext('2d');
  context.drawImage(photo, 0, 0, photo.width, photo.height);
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(maskCanvas, 0, 0, photo.width, photo.height);
  context.globalCompositeOperation = 'source-over';
  return foreground;
}

export function fillCanvasWhite(context, canvasSize) {
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvasSize.width, canvasSize.height);
}

export function drawPhotoLayer(context, source, imageSize, canvasSize) {
  const { scale, offsetX, offsetY } = getCoverTransform(imageSize, canvasSize);
  context.drawImage(
    source,
    offsetX,
    offsetY,
    imageSize.width * scale,
    imageSize.height * scale
  );
}
```

- [ ] **Step 4: Run the compositing tests and full suite**

Run:

```bash
node --test tests/background-composite.test.mjs
npm test
```

Expected focused tests: 2 tests pass, 0 fail.

Expected full suite: exit code 0 and 0 failed tests.

- [ ] **Step 5: Commit the canvas boundary**

```bash
git add js/background-composite.js tests/background-composite.test.mjs
git commit -m "feat(background): composite people over white"
```

### Task 3: Per-photo background session and stale-result protection

**Files:**
- Create: `js/background-session.js`
- Create: `tests/background-session.test.mjs`

**Interfaces:**
- Consumes: a `segmenter` exposing `segmentPeople(photo)` and `reset()`, plus `foregroundBuilder(photo, mask)`.
- Produces: `createBackgroundSession({ segmenter, foregroundBuilder, onChange })` with `analyze(photo)`, `retry()`, `reset()`, and `getState()`.
- Publishes exact shapes for `idle`, `loading`, `ready`, and `error`: `{ status, photo, foreground, error }`.

- [ ] **Step 1: Write failing session tests**

Create `tests/background-session.test.mjs` with a local `deferred()` helper equivalent to Task 1 and these exact tests:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackgroundSession } from '../js/background-session.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('publishes loading and caches one foreground when analysis succeeds', async () => {
  const photo = { id: 'photo' };
  const mask = { width: 1, height: 1, confidence: new Float32Array([1]) };
  const foreground = { id: 'foreground' };
  const states = [];
  const session = createBackgroundSession({
    segmenter: { segmentPeople: async () => mask, reset() {} },
    foregroundBuilder: (photoArg, maskArg) => {
      assert.equal(photoArg, photo);
      assert.equal(maskArg, mask);
      return foreground;
    },
    onChange: state => states.push(state)
  });

  await session.analyze(photo);
  assert.deepEqual(states.map(state => state.status), ['loading', 'ready']);
  assert.deepEqual(session.getState(), {
    status: 'ready',
    photo,
    foreground,
    error: null
  });
});

test('retry resets only the segmenter and reuses the retained photo', async () => {
  const photo = { id: 'photo' };
  const calls = [];
  let attempt = 0;
  const session = createBackgroundSession({
    segmenter: {
      async segmentPeople(photoArg) {
        calls.push(['segment', photoArg]);
        attempt += 1;
        if (attempt === 1) throw new Error('first failure');
        return { width: 1, height: 1, confidence: new Float32Array([1]) };
      },
      reset() { calls.push(['reset']); }
    },
    foregroundBuilder: () => ({ id: 'foreground' })
  });

  await session.analyze(photo);
  assert.equal(session.getState().status, 'error');
  await session.retry();
  assert.equal(session.getState().status, 'ready');
  assert.deepEqual(calls, [['segment', photo], ['reset'], ['segment', photo]]);
});

test('older success and failure cannot replace the newest photo', async () => {
  const oldRequest = deferred();
  const newRequest = deferred();
  const requests = [oldRequest.promise, newRequest.promise];
  const session = createBackgroundSession({
    segmenter: { segmentPeople: () => requests.shift(), reset() {} },
    foregroundBuilder: photo => ({ id: `foreground-${photo.id}` })
  });

  const oldAnalysis = session.analyze({ id: 'old' });
  const newPhoto = { id: 'new' };
  const newAnalysis = session.analyze(newPhoto);
  newRequest.resolve({ width: 1, height: 1, confidence: new Float32Array([1]) });
  await newAnalysis;
  oldRequest.reject(new Error('old failure'));
  await oldAnalysis;

  assert.equal(session.getState().status, 'ready');
  assert.equal(session.getState().photo, newPhoto);
  assert.deepEqual(session.getState().foreground, { id: 'foreground-new' });
});

test('reset invalidates pending work and restores the exact idle state', async () => {
  const request = deferred();
  const states = [];
  const session = createBackgroundSession({
    segmenter: { segmentPeople: () => request.promise, reset() {} },
    foregroundBuilder: () => ({ id: 'foreground' }),
    onChange: state => states.push(state)
  });

  const analysis = session.analyze({ id: 'photo' });
  session.reset();
  request.resolve({ width: 1, height: 1, confidence: new Float32Array([1]) });
  await analysis;

  assert.deepEqual(session.getState(), {
    status: 'idle',
    photo: null,
    foreground: null,
    error: null
  });
  assert.deepEqual(states.map(state => state.status), ['loading', 'idle']);
});
```

- [ ] **Step 2: Run the session tests and verify RED**

Run: `node --test tests/background-session.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/background-session.js`.

- [ ] **Step 3: Implement the stale-safe session**

Create `js/background-session.js`:

```js
const idleState = () => ({
  status: 'idle',
  photo: null,
  foreground: null,
  error: null
});

export function createBackgroundSession({
  segmenter,
  foregroundBuilder,
  onChange = () => {}
}) {
  let requestId = 0;
  let state = idleState();

  function publish(next) {
    state = next;
    onChange(state);
  }

  async function analyze(photo) {
    const currentRequest = ++requestId;
    publish({ status: 'loading', photo, foreground: null, error: null });
    try {
      const mask = await segmenter.segmentPeople(photo);
      if (currentRequest !== requestId) return;
      const foreground = foregroundBuilder(photo, mask);
      if (currentRequest !== requestId) return;
      publish({ status: 'ready', photo, foreground, error: null });
    } catch (error) {
      if (currentRequest !== requestId) return;
      publish({ status: 'error', photo, foreground: null, error });
    }
  }

  return {
    analyze,
    retry() {
      segmenter.reset();
      return state.photo ? analyze(state.photo) : Promise.resolve();
    },
    reset() {
      requestId += 1;
      publish(idleState());
    },
    getState() {
      return state;
    }
  };
}
```

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test tests/background-session.test.mjs
npm test
```

Expected focused tests: 4 tests pass, 0 fail.

Expected full suite: exit code 0 and 0 failed tests.

- [ ] **Step 5: Commit the background session**

```bash
git add js/background-session.js tests/background-session.test.mjs
git commit -m "feat(background): cache segmentation per photo"
```

### Task 4: App orchestration, status UI, render order, and frame reuse

**Files:**
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `tests/app.test.mjs`

**Interfaces:**
- Extend `createApp()` injection with `backgroundSegmenter`, `foregroundBuilder`, and `photoLayerDrawer`.
- Preserve `getState().analysis` for face state and add `getState().background` for background state.
- Add DOM IDs `backgroundStatus` and `retryBackgroundBtn`.

- [ ] **Step 1: Extend the app test harness with independent background dependencies**

Update `makeAppHarness()` in `tests/app.test.mjs` so its options include `backgroundOutcomes` and its element IDs include the new background feedback controls:

```js
const DEFAULT_MASK = {
  width: 1,
  height: 1,
  confidence: new Float32Array([1])
};

function makeAppHarness({
  faces = [],
  error = null,
  backgroundOutcomes = [DEFAULT_MASK],
  windowRef = {}
} = {}) {
  const ids = [
    'canvas', 'photoInput', 'cameraBtn', 'frameGrid', 'resultArea',
    'downloadBtn', 'resetBtn', 'video', 'faceStatus', 'retryDetectionBtn',
    'backgroundStatus', 'retryBackgroundBtn'
  ];
```

Inside that harness, add deterministic background counters and drawing records, then pass the dependencies into `createApp()`:

```js
const renderCalls = [];
const segmenterCalls = [];
const segmenterResets = [];
const foregroundBuilds = [];
const foreground = makeLoadedImage(400, 500);
let backgroundAttempt = 0;
const backgroundSegmenter = {
  async segmentPeople(photo) {
    segmenterCalls.push(photo);
    const outcome = backgroundOutcomes[
      Math.min(backgroundAttempt, backgroundOutcomes.length - 1)
    ];
    backgroundAttempt += 1;
    if (outcome instanceof Error) throw outcome;
    return await outcome;
  },
  reset() {
    segmenterResets.push(true);
  }
};
```

Record `fillRect()` as `white`, inject the foreground builder/layer drawer, and return the new records:

```js
fillRect() { renderCalls.push('white'); },

backgroundSegmenter,
foregroundBuilder(photo, mask) {
  foregroundBuilds.push({ photo, mask });
  return foreground;
},
photoLayerDrawer(contextArg, source) {
  renderCalls.push(source === foreground ? 'foreground' : 'fallback');
  contextArg.drawImage(source, 0, 0);
},

return {
  app,
  elements,
  drawCalls,
  detectorCalls,
  photoDraws,
  renderCalls,
  segmenterCalls,
  segmenterResets,
  foregroundBuilds,
  foreground
};
```

In the injected `overlayDrawer`, push `overlay` immediately before recording per-face placements:

```js
overlayDrawer(contextArg, prepared, frame, placements) {
  renderCalls.push('overlay');
  placements.forEach(placement => {
    drawCalls.push({ kind: 'overlay', frame, placement });
  });
}
```

- [ ] **Step 2: Add failing app integration tests**

Append these exact behavioral tests to `tests/app.test.mjs`:

```js
test('draws white, cached foreground, then overlays and reuses both analyses on frame changes', async () => {
  const harness = makeAppHarness({
    faces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }]
  });
  harness.app.init();
  await harness.app.setPhoto(makeLoadedImage(400, 500));
  harness.elements.frameGrid.children[0].listeners.click();

  harness.renderCalls.length = 0;
  harness.app.renderCanvas();
  assert.deepEqual(harness.renderCalls, ['white', 'foreground', 'overlay']);
  assert.equal(harness.drawCalls.at(-1).kind, 'overlay');

  harness.elements.frameGrid.children[1].listeners.click();
  assert.equal(harness.detectorCalls.length, 1);
  assert.equal(harness.segmenterCalls.length, 1);
  assert.equal(harness.foregroundBuilds.length, 1);
});

test('keeps the preview white while background segmentation is loading', async () => {
  let resolveMask;
  const pendingMask = new Promise(resolve => { resolveMask = resolve; });
  const controlled = makeAppHarness({ backgroundOutcomes: [pendingMask] });
  controlled.app.init();
  const pendingPhoto = controlled.app.setPhoto(makeLoadedImage(400, 500));
  controlled.renderCalls.length = 0;
  controlled.app.renderCanvas();
  assert.deepEqual(controlled.renderCalls, ['white']);

  resolveMask(DEFAULT_MASK);
  await pendingPhoto;
});

test('keeps a frame selected before a photo and applies it after both analyses finish', async () => {
  const harness = makeAppHarness({
    faces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }]
  });
  harness.app.init();
  harness.elements.frameGrid.children[0].listeners.click();
  await harness.app.setPhoto(makeLoadedImage(400, 500));

  assert.equal(harness.elements.frameGrid.children[0].classList.contains('active'), true);
  assert.equal(harness.drawCalls.at(-1).kind, 'overlay');
  assert.equal(harness.detectorCalls.length, 1);
  assert.equal(harness.segmenterCalls.length, 1);
});

test('shows original fallback and retries background without redetecting faces', async () => {
  const harness = makeAppHarness({
    faces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }],
    backgroundOutcomes: [new Error('segment failed'), DEFAULT_MASK]
  });
  harness.app.init();
  await harness.app.setPhoto(makeLoadedImage(400, 500));
  assert.equal(
    harness.elements.backgroundStatus.textContent,
    '배경을 지우지 못했어요. 원본 사진으로 표시합니다.'
  );
  assert.equal(harness.elements.retryBackgroundBtn.hidden, false);
  harness.elements.frameGrid.children[0].listeners.click();

  harness.renderCalls.length = 0;
  harness.app.renderCanvas();
  assert.deepEqual(harness.renderCalls, ['white', 'fallback', 'overlay']);
  await harness.elements.retryBackgroundBtn.listeners.click();
  assert.equal(harness.elements.backgroundStatus.textContent, '흰색 배경을 적용했어요.');
  assert.equal(harness.detectorCalls.length, 1);
  assert.equal(harness.segmenterCalls.length, 2);
  assert.equal(harness.segmenterResets.length, 1);
});

test('reset clears background state, status, and cached foreground', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.app.setPhoto(makeLoadedImage(400, 500));
  harness.elements.resetBtn.listeners.click();

  assert.equal(harness.app.getState().background.status, 'idle');
  assert.equal(harness.app.getState().background.foreground, null);
  assert.equal(harness.elements.backgroundStatus.textContent, '');
  assert.equal(harness.elements.retryBackgroundBtn.hidden, true);
});
```

- [ ] **Step 3: Add failing HTML contract assertions**

Add to `tests/app.test.mjs`:

```js
test('exposes independent accessible background status and retry controls', () => {
  assert.match(indexHtml, /id="backgroundStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(indexHtml, /id="retryBackgroundBtn"[^>]*hidden/);
  assert.match(indexHtml, />\s*배경 다시 시도\s*</);
});
```

Run: `node --test tests/app.test.mjs`

Expected: FAIL because the app does not yet accept background dependencies and the new DOM nodes do not exist.

- [ ] **Step 4: Add the background feedback markup**

In `index.html`, add this block immediately after `.face-feedback`:

```html
<div class="background-feedback">
    <p id="backgroundStatus" class="background-status" role="status" aria-live="polite"></p>
    <button id="retryBackgroundBtn" class="btn-secondary retry-background" type="button" hidden>
        배경 다시 시도
    </button>
</div>
```

- [ ] **Step 5: Integrate background dependencies and independent status state**

Add imports to `js/app.js`:

```js
import {
    createPersonForeground,
    drawPhotoLayer,
    fillCanvasWhite
} from './background-composite.js';
import { createBackgroundSegmentationService } from './background-segmentation.js';
import { createBackgroundSession } from './background-session.js';
```

Extend `createApp()` defaults:

```js
backgroundSegmenter = createBackgroundSegmentationService(),
foregroundBuilder = createPersonForeground,
photoLayerDrawer = drawPhotoLayer,
```

Add `backgroundStatus` and `retryBackgroundBtn` to the `elements` object. Rename the current `session` variable to `faceSession`, then create the background session beside it:

```js
const backgroundSession = createBackgroundSession({
    segmenter: backgroundSegmenter,
    foregroundBuilder,
    onChange(background) {
        const messages = {
            idle: '',
            loading: '배경을 흰색으로 정리하는 중…',
            ready: '흰색 배경을 적용했어요.',
            error: '배경을 지우지 못했어요. 원본 사진으로 표시합니다.'
        };
        elements.backgroundStatus.textContent = messages[background.status];
        elements.retryBackgroundBtn.hidden = background.status !== 'error';
        renderCanvas();
    }
});
```

Bind retries independently:

```js
elements.retryDetectionBtn.addEventListener('click', () => faceSession.retry());
elements.retryBackgroundBtn.addEventListener('click', () => backgroundSession.retry());
```

- [ ] **Step 6: Run both analyses once and implement the exact render layers**

Replace `commitPhoto()` and `renderCanvas()` with:

```js
async function commitPhoto(image) {
    state.currentPhoto = image;
    elements.resultArea.style.display = 'block';
    renderCanvas();
    await Promise.all([
        faceSession.analyze(image),
        backgroundSession.analyze(image)
    ]);
}

function renderCanvas() {
    const canvasSize = { width: canvas.width, height: canvas.height };
    fillCanvasWhite(context, canvasSize);
    if (!state.currentPhoto) return;

    const imageSize = {
        width: state.currentPhoto.width,
        height: state.currentPhoto.height
    };
    const background = backgroundSession.getState();
    if (background.status === 'ready') {
        photoLayerDrawer(context, background.foreground, imageSize, canvasSize);
    } else if (background.status === 'error') {
        photoLayerDrawer(context, state.currentPhoto, imageSize, canvasSize);
    } else {
        return;
    }

    const analysis = faceSession.getState();
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
```

In `reset()`, call both `faceSession.reset()` and `backgroundSession.reset()`. Preserve `preparedFrames.clear()` because it caches frame artwork, not photo analysis.

Return both states without breaking existing callers:

```js
getState: () => ({
    ...state,
    analysis: faceSession.getState(),
    background: backgroundSession.getState()
})
```

- [ ] **Step 7: Run app integration and full tests**

Run:

```bash
node --test tests/app.test.mjs
npm test
```

Expected: all app tests pass, then the full suite exits 0 with 0 failed tests.

- [ ] **Step 8: Commit app integration**

```bash
git add js/app.js index.html tests/app.test.mjs
git commit -m "feat(app): integrate automatic white background"
```

### Task 5: Large responsive preview and non-overlapping frame cards

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `tests/styles.test.cjs`

**Interfaces:**
- Output canvas logical size: exactly 600×750.
- Desktop grid: exactly `minmax(0, 7fr) minmax(320px, 5fr)` above 900px.
- Desktop photo card: sticky with `top: 20px` and `align-self: start`.
- Mobile photo card: static at and below 900px.
- Narrow frame grid: two shrinkable columns at and below 480px.

- [ ] **Step 1: Write failing layout contracts**

Append to `tests/styles.test.cjs`:

```js
const html = fs.readFileSync('index.html', 'utf8');

test('uses a sharper 4:5 logical canvas for the primary result preview', () => {
    assert.match(html, /<canvas id="canvas" width="600" height="750"><\/canvas>/);
    assert.match(css, /#canvas\s*{[^}]*width:\s*100%[^}]*height:\s*auto[^}]*aspect-ratio:\s*4\s*\/\s*5/s);
});

test('emphasizes and sticks the photo preview on desktop', () => {
    assert.match(css, /\.booth\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*7fr\)\s*minmax\(320px,\s*5fr\)/s);
    assert.match(css, /\.photo-section\s*{[^}]*position:\s*sticky[^}]*top:\s*20px[^}]*align-self:\s*start/s);
});

test('restores normal flow for the photo preview on single-column screens', () => {
    assert.match(css, /@media\s*\(max-width:\s*900px\)\s*{[\s\S]*?\.photo-section\s*{[^}]*position:\s*static/s);
});

test('keeps two shrinkable frame columns without horizontal overflow on phones', () => {
    assert.match(css, /@media\s*\(max-width:\s*480px\)\s*{[\s\S]*?\.frame-grid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*overflow-x:\s*hidden/s);
});
```

Run: `node --test tests/styles.test.cjs`

Expected: FAIL on the 600×750 canvas, weighted desktop grid, sticky preview, and explicit mobile sticky reset.

- [ ] **Step 2: Increase the canvas logical output size**

Change the canvas in `index.html` to:

```html
<canvas id="canvas" width="600" height="750"></canvas>
```

- [ ] **Step 3: Implement the desktop preview emphasis**

Apply these exact declarations in `css/styles.css` while retaining the current card appearance:

```css
.booth {
    display: grid;
    grid-template-columns: minmax(0, 7fr) minmax(320px, 5fr);
    gap: 30px;
    margin-bottom: 40px;
    animation: fadeIn 0.8s ease-out;
}

.photo-section {
    position: sticky;
    top: 20px;
    align-self: start;
}

.preview-area {
    min-height: 0;
    aspect-ratio: 4 / 5;
}

#canvas {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 5;
}

.frame-grid {
    max-height: min(750px, calc(100vh - 220px));
    overflow-y: auto;
    overflow-x: hidden;
}
```

Merge these declarations into the existing selectors rather than duplicating selectors. Remove the old `.preview-area { min-height: 400px; }` and old `#canvas` max-size declarations.

- [ ] **Step 4: Implement feedback and mobile layout rules**

Share the current feedback layout and typography across face/background status:

```css
.face-feedback,
.background-feedback {
    min-height: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.face-status,
.background-status {
    flex: 1;
    color: #666;
    font-size: 0.95rem;
}

.retry-detection,
.retry-background {
    flex: 0 0 auto;
    min-width: auto;
    padding: 8px 12px;
}
```

Inside the existing 900px media query, add:

```css
.photo-section {
    position: static;
    top: auto;
}

.frame-grid {
    max-height: 500px;
}
```

Inside the existing 480px media query, keep the two shrinkable columns and add `overflow-x: hidden` in that same `.frame-grid` rule.

- [ ] **Step 5: Run layout and full tests**

Run:

```bash
node --test tests/styles.test.cjs
npm test
```

Expected: all style-contract tests pass, then the full suite exits 0 with 0 failed tests.

- [ ] **Step 6: Commit the large preview layout**

```bash
git add index.html css/styles.css tests/styles.test.cjs
git commit -m "feat(preview): enlarge the live frame result"
```

### Task 6: User documentation and end-to-end verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update feature and privacy documentation**

Update `README.md` so it explicitly states:

- Uploaded photos and captured stills automatically attempt to replace the photographed environment with white.
- All people retained by SelfieSegmenter remain in the composition.
- Frame changes reuse both face and background analysis.
- Segmentation failure falls back to the original photo and exposes an independent retry.
- Photos, landmarks, masks, and foreground canvases remain in the browser.
- `assets/models/` contains both `face_landmarker.task` and `selfie_segmenter.tflite`.
- The module tree includes `background-segmentation.js`, `background-composite.js`, and `background-session.js`.

- [ ] **Step 2: Run static and automated verification**

Run:

```bash
git diff --check
npm test
git status --short
```

Expected:

- `git diff --check` exits 0 with no output.
- `npm test` exits 0 with 0 failed tests.
- `git status --short` lists only the intended README change before the documentation commit.

- [ ] **Step 3: Commit documentation**

```bash
git add README.md
git commit -m "docs(background): explain automatic white composition"
```

- [ ] **Step 4: Start the local app for browser acceptance**

Run: `npm start`

Expected: the static server listens on `http://localhost:8000/` without module 404 errors.

- [ ] **Step 5: Verify the approved single-person example in a real browser**

Use the `browser:control-in-app-browser` skill and open `http://localhost:8000/`. Upload:

```text
/var/folders/d1/1g0xsk4s4y79xzlb526tlt440000gn/T/codex-clipboard-9392346b-7227-4523-9f71-a54c0e6bdd58.png
```

Verify all of these visible outcomes:

1. The preview stays white while person segmentation is pending; the window/road environment never flashes.
2. The completed result replaces the real photographed environment with white while retaining the person, hair, clothes, and pink character frame as the model permits.
3. Clicking at least three frame cards updates the same large left preview.
4. The selected card keeps its active border/check state.
5. The background status reads `흰색 배경을 적용했어요.` after success.
6. Downloaded PNG dimensions are 600×750 and its visible composition matches the canvas.

- [ ] **Step 6: Verify multi-person, responsive, fallback, and stale-state behavior**

In the same browser session:

1. Upload a photo containing at least two visible people and verify every retained person remains while the same selected frame appears on each detected face, up to ten.
2. Resize to 1280px width and confirm the preview is visually dominant, the photo card sticks, and the frame grid scrolls independently.
3. Resize to 900px, 480px, and 320px widths and confirm single-column flow, non-sticky preview, two frame columns at 480px and below, and no horizontal overflow or card overlap.
4. In a fresh browser tab, add the DevTools Network Request Blocking pattern `*selfie_segmenter.tflite*`, reload, and upload a photo. Verify original-photo fallback and the exact error message. Remove the blocking pattern, click `배경 다시 시도`, and verify recovery without another face analysis.
5. Start a slow background analysis, replace the photo, and confirm the old result cannot overwrite the newer photo.
6. Start a slow background analysis, press reset, and confirm the old result cannot restore the cleared preview.

- [ ] **Step 7: Perform final branch verification before declaring completion**

Use the `superpowers:verification-before-completion` skill, then run:

```bash
git diff --check HEAD~6..HEAD
npm test
git status --short --branch
```

Expected:

- The diff check exits 0.
- The full suite exits 0 with 0 failed tests.
- The working tree is clean.
- Report any observed segmentation-quality limitation honestly rather than classifying model quality as a code failure.
