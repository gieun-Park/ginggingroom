# Mobile Camera Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile camera framing easier with an 80% compensated costume frame, capability-gated 0.5x/0.8x/1x hardware zoom, and an off/3/5/7-second timer.

**Architecture:** Keep frame math in `frame-overlay.js`, camera capability logic in a new dependency-free `camera-controls.js`, and browser lifecycle/UI coordination in `app.js`. The live renderer receives an explicit overlay scale, while the prepared-frame cache keys mask variants separately so camera captures and uploads cannot leak rendering profiles into each other.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript ES modules, Canvas 2D, MediaStreamTrack constraints, `node:test`

## Global Constraints

- Mobile camera preview and camera capture at `max-width: 480px` use `overlayScale: 0.8` and `maskScale: 1.25`.
- Desktop camera and uploaded photos keep `overlayScale: 1` and `maskScale: 1`.
- Timer order is exactly `끔 → 3초 → 5초 → 7초 → 끔`.
- Zoom candidates are exactly `0.5`, `0.8`, and `1`; show the control only when at least two candidates are supported by the active track.
- Do not simulate zoom, enumerate cameras, guess lenses, modify frame PNGs/model binaries, add dependencies, or change upload composition.
- Camera frames, masks, landmarks, and composed images remain in the browser with no uploads, remote processing, analytics, or telemetry.
- Preserve permission fallback, image upload, mirrored live composition, PNG download, responsive layout, and ML failure fallback.

---

### Task 1: Hardware Zoom Capability Module

**Files:**
- Create: `js/camera-controls.js`
- Create: `tests/camera-controls.test.mjs`

**Interfaces:**
- Consumes: a `MediaTrackCapabilities`-shaped object and a `MediaStreamTrack`-shaped object.
- Produces: `CAMERA_ZOOM_OPTIONS`, `getSupportedZoomOptions(capabilities, candidates?)`, and `applyCameraZoom(track, zoom)`.

- [ ] **Step 1: Write the failing zoom capability tests**

Create `tests/camera-controls.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCameraZoom,
  CAMERA_ZOOM_OPTIONS,
  getSupportedZoomOptions
} from '../js/camera-controls.js';

test('offers only candidate zoom values represented by the track range and step', () => {
  assert.deepEqual(CAMERA_ZOOM_OPTIONS, [0.5, 0.8, 1]);
  assert.deepEqual(
    getSupportedZoomOptions({ zoom: { min: 0.5, max: 1, step: 0.1 } }),
    [0.5, 0.8, 1]
  );
  assert.deepEqual(
    getSupportedZoomOptions({ zoom: { min: 0.5, max: 1, step: 0.25 } }),
    [0.5, 1]
  );
});

test('returns no zoom choices when capabilities are missing or malformed', () => {
  assert.deepEqual(getSupportedZoomOptions(), []);
  assert.deepEqual(getSupportedZoomOptions({}), []);
  assert.deepEqual(getSupportedZoomOptions({ zoom: { min: 1, max: 0.5, step: 0.1 } }), []);
});

test('accepts floating-point step values within tolerance', () => {
  assert.deepEqual(
    getSupportedZoomOptions(
      { zoom: { min: 0.5, max: 0.8, step: 0.1 } },
      [0.7000000000000001]
    ),
    [0.7000000000000001]
  );
});

test('applies zoom as an advanced video constraint', async () => {
  const calls = [];
  const track = {
    async applyConstraints(constraints) {
      calls.push(constraints);
    }
  };

  await applyCameraZoom(track, 0.8);

  assert.deepEqual(calls, [{ advanced: [{ zoom: 0.8 }] }]);
});

test('rejects when the active track cannot apply constraints', async () => {
  await assert.rejects(
    applyCameraZoom({}, 0.8),
    /카메라 배율을 변경할 수 없어요/
  );
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `node --test tests/camera-controls.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/camera-controls.js`.

- [ ] **Step 3: Implement the minimal zoom module**

Create `js/camera-controls.js`:

```js
export const CAMERA_ZOOM_OPTIONS = Object.freeze([0.5, 0.8, 1]);

const FLOAT_TOLERANCE = 1e-6;

function isFiniteRange(range) {
  return Number.isFinite(range?.min)
    && Number.isFinite(range?.max)
    && range.min <= range.max;
}

function isStepAligned(value, min, step) {
  if (!Number.isFinite(step) || step <= 0) return true;
  const stepCount = (value - min) / step;
  return Math.abs(stepCount - Math.round(stepCount)) <= FLOAT_TOLERANCE;
}

export function getSupportedZoomOptions(
  capabilities,
  candidates = CAMERA_ZOOM_OPTIONS
) {
  const range = capabilities?.zoom;
  if (!isFiniteRange(range)) return [];

  return candidates.filter(value => (
    Number.isFinite(value)
    && value >= range.min - FLOAT_TOLERANCE
    && value <= range.max + FLOAT_TOLERANCE
    && isStepAligned(value, range.min, range.step)
  ));
}

export async function applyCameraZoom(track, zoom) {
  if (typeof track?.applyConstraints !== 'function') {
    throw new Error('카메라 배율을 변경할 수 없어요.');
  }
  await track.applyConstraints({ advanced: [{ zoom }] });
}
```

- [ ] **Step 4: Run targeted and full tests**

Run: `node --test tests/camera-controls.test.mjs`

Expected: 5 passing tests.

Run: `npm test`

Expected: all existing tests plus the 5 new tests pass.

- [ ] **Step 5: Commit the zoom module**

```bash
git add js/camera-controls.js tests/camera-controls.test.mjs
git commit -m "feat(camera): add hardware zoom capability helpers"
```

---

### Task 2: Compensated Mobile Frame Rendering

**Files:**
- Modify: `js/frame-overlay.js:1-43`
- Modify: `js/camera-renderer.js:33-52`
- Modify: `tests/frame-overlay.test.mjs:31-87`
- Modify: `tests/camera-renderer.test.mjs:50-66`

**Interfaces:**
- Consumes: `maskScale` in `prepareFrameImage` options and `overlayScale` in `drawLiveComposition`.
- Produces: `prepareFrameImage(frameImage, frame, options?)` and `drawFrameOverlays(context, preparedFrame, frame, placements, overlayScale?)`.

- [ ] **Step 1: Add failing mask and overlay scale tests**

Change the existing preparation call in `tests/frame-overlay.test.mjs` to use an options object:

```js
const prepared = prepareFrameImage(
  frameImage,
  frame,
  { createCanvas: () => canvas }
);
```

Add:

```js
test('expands face masks independently from the prepared bitmap size', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };

  prepareFrameImage(frameImage, frame, {
    createCanvas: () => canvas,
    maskScale: 1.25
  });

  assert.deepEqual(
    context.calls.filter(call => call[0] === 'ellipse'),
    [
      ['ellipse', 240, 192, 60, 60, 0, 0, Math.PI * 2],
      ['ellipse', 336, 192, 30, 30, 0, 0, Math.PI * 2]
    ]
  );
});

test('scales costume artwork without moving the face anchor', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placement = { centerX: 100, centerY: 120, width: 40, height: 45, rotation: 0.1 };
  const baseScale = Math.max(
    placement.width * frame.fitPadding / (frame.faceAnchor.width * prepared.width),
    placement.height * frame.fitPadding / (frame.faceAnchor.height * prepared.height)
  );

  drawFrameOverlays(context, prepared, frame, [placement], 0.8);

  assert.deepEqual(context.calls.find(call => call[0] === 'translate'), ['translate', 100, 120]);
  assert.deepEqual(context.calls.find(call => call[0] === 'scale'), ['scale', baseScale * 0.8, baseScale * 0.8]);
});
```

Update the live composition test in `tests/camera-renderer.test.mjs`:

```js
drawLiveComposition({
  context,
  source: { id: 'video' },
  sourceSize: { width: 400, height: 500 },
  canvasSize: { width: 400, height: 500 },
  faces: [{ centerX: .25, centerY: .5, width: .2, height: .3, rotation: 0 }],
  preparedFrame: {},
  frame: {},
  overlayScale: 0.8,
  overlayDrawer: (...args) => overlays.push(args)
});
assert.equal(overlays[0][4], 0.8);
```

- [ ] **Step 2: Run focused tests and verify behavioral failures**

Run: `node --test tests/frame-overlay.test.mjs tests/camera-renderer.test.mjs`

Expected: FAIL because the current third argument is treated as a function, masks remain unscaled, and the overlay scale is not forwarded.

- [ ] **Step 3: Implement frame mask and draw scaling**

Replace `prepareFrameImage` in `js/frame-overlay.js` with:

```js
export function prepareFrameImage(frameImage, frame, {
  createCanvas = () => document.createElement('canvas'),
  maskScale = 1
} = {}) {
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
      anchor.width * maskScale * canvas.width / 2,
      anchor.height * maskScale * canvas.height / 2,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
  });
  context.globalCompositeOperation = 'source-over';
  return canvas;
}
```

Change `drawFrameOverlays` to accept and apply `overlayScale`:

```js
export function drawFrameOverlays(
  context,
  preparedFrame,
  frame,
  placements,
  overlayScale = 1
) {
  const anchorX = frame.faceAnchor.centerX * preparedFrame.width;
  const anchorY = frame.faceAnchor.centerY * preparedFrame.height;
  const anchorWidth = frame.faceAnchor.width * preparedFrame.width;
  const anchorHeight = frame.faceAnchor.height * preparedFrame.height;

  placements.forEach(placement => {
    const fitScale = Math.max(
      placement.width * frame.fitPadding / anchorWidth,
      placement.height * frame.fitPadding / anchorHeight
    );
    const scale = fitScale * overlayScale;
    context.save();
    context.translate(placement.centerX, placement.centerY);
    context.rotate(placement.rotation);
    context.scale(scale, scale);
    context.drawImage(preparedFrame, -anchorX, -anchorY);
    context.restore();
  });
}
```

Add `overlayScale = 1` to the `drawLiveComposition` parameter list in `js/camera-renderer.js` and forward it:

```js
overlayDrawer(context, preparedFrame, frame, placements, overlayScale);
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/frame-overlay.test.mjs tests/camera-renderer.test.mjs`

Expected: all frame-overlay and camera-renderer tests pass.

Run: `npm test`

Expected: all tests pass with no warnings.

- [ ] **Step 5: Commit frame rendering**

```bash
git add js/frame-overlay.js js/camera-renderer.js tests/frame-overlay.test.mjs tests/camera-renderer.test.mjs
git commit -m "feat(camera): scale mobile frames with mask compensation"
```

---

### Task 3: Camera Rendering Profiles and Variant Cache

**Files:**
- Modify: `js/app.js:12-60,90-100,249-299`
- Modify: `tests/app.test.mjs:68-275,439-461,522-536`

**Interfaces:**
- Consumes: `windowRef.matchMedia('(max-width: 480px)')`.
- Produces: camera-only `{ overlayScale: 0.8, maskScale: 1.25 }`; all other composition uses `{ overlayScale: 1, maskScale: 1 }`.

- [ ] **Step 1: Extend the harness and write failing rendering-profile tests**

In `makeAppHarness`, add:

```js
const framePrepareCalls = [];
```

Replace the `framePreparer` stub with:

```js
framePreparer(frameImage, frame, options) {
  framePrepareCalls.push({ frameImage, frame, options });
  return { width: 480, height: 480, maskScale: options?.maskScale ?? 1 };
},
```

Return `framePrepareCalls` from the harness.

Add:

```js
test('uses the compensated 80 percent frame profile only for mobile camera composition', async () => {
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
  assert.equal(harness.liveDraws.at(-1).preparedFrame.maskScale, 1.25);
  assert.equal(harness.framePrepareCalls.at(-1).options.maskScale, 1.25);

  harness.elements.shutterBtn.listeners.click();
  assert.equal(harness.liveDraws.at(-1).overlayScale, 0.8);
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
    [1.25, 1]
  );
});
```

Update the `overlayDrawer` stub so it records the optional scale:

```js
overlayDrawer(contextArg, preparedFrame, frame, placements, overlayScale = 1) {
  overlayCalls.push({ context: contextArg, preparedFrame, frame, placements, overlayScale });
},
```

- [ ] **Step 2: Run the app tests and verify the new assertions fail**

Run: `node --test tests/app.test.mjs`

Expected: FAIL because `app.js` does not read the media query, pass `maskScale`, forward `overlayScale`, or cache frame variants separately.

- [ ] **Step 3: Implement camera rendering profiles**

Add near the imports in `js/app.js`:

```js
const DEFAULT_RENDERING_PROFILE = Object.freeze({ overlayScale: 1, maskScale: 1 });
const MOBILE_CAMERA_RENDERING_PROFILE = Object.freeze({ overlayScale: 0.8, maskScale: 1.25 });
const MOBILE_CAMERA_QUERY = '(max-width: 480px)';
```

Create the query after `preparedFrames`:

```js
const mobileCameraMedia = typeof windowRef.matchMedia === 'function'
  ? windowRef.matchMedia(MOBILE_CAMERA_QUERY)
  : null;
```

Replace the frame preload invalidation with:

```js
clearPreparedFrameVariants(frameId);
```

Add:

```js
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
```

Replace `getPreparedFrame` with:

```js
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
```

Keep uploads explicit in `renderPhoto`:

```js
const preparedFrame = getPreparedFrame(DEFAULT_RENDERING_PROFILE.maskScale);
```

Pass the default scale to the still-image overlay call:

```js
overlayDrawer(
  context,
  preparedFrame,
  state.currentFrame,
  placements,
  DEFAULT_RENDERING_PROFILE.overlayScale
);
```

Update `renderLiveFrame`:

```js
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
```

- [ ] **Step 4: Run app and full tests**

Run: `node --test tests/app.test.mjs`

Expected: all app tests pass.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit profile integration**

```bash
git add js/app.js tests/app.test.mjs
git commit -m "feat(app): apply mobile camera frame profile"
```

---

### Task 4: Capability-Gated Zoom UI and Lifecycle

**Files:**
- Modify: `index.html:18-23`
- Modify: `css/styles.css:78-117,203-273,306-344`
- Modify: `js/app.js:1-60,90-216,340-417,451-468`
- Modify: `tests/app.test.mjs:12-275,319-437,478-567,665-675`
- Modify: `tests/styles.test.cjs:21-59`

**Interfaces:**
- Consumes: Task 1's `CAMERA_ZOOM_OPTIONS`, `getSupportedZoomOptions`, and `applyCameraZoom`.
- Produces: `state.supportedZooms`, `state.preferredZoom`, `state.currentZoom`, and accessible `zoomControls`.

- [ ] **Step 1: Add failing zoom markup and style tests**

Add to `tests/styles.test.cjs`:

```js
test('provides an accessible hardware zoom group inside the camera stage', () => {
    assert.match(html, /class="camera-stage"[\s\S]*id="zoomControls"[^>]*role="group"[^>]*aria-label="카메라 배율"[^>]*hidden/);
    assert.match(html, /id="zoom05Btn"[^>]*aria-pressed="false"[^>]*>0\.5x</);
    assert.match(html, /id="zoom08Btn"[^>]*aria-pressed="false"[^>]*>0\.8x</);
    assert.match(html, /id="zoom1Btn"[^>]*aria-pressed="false"[^>]*>1x</);
});

test('keeps zoom controls touch-sized and camera status clear of the zoom pill', () => {
    assert.match(css, /\.camera-zoom\s*{[^}]*position:\s*absolute[^}]*left:\s*50%[^}]*bottom:\s*16px[^}]*display:\s*flex/s);
    assert.match(css, /\.zoom-btn\s*{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
    assert.match(css, /\.camera-status\s*{[^}]*top:\s*18px[^}]*bottom:\s*auto/s);
});
```

- [ ] **Step 2: Add failing app zoom lifecycle tests**

Extend harness IDs:

```js
'zoomControls', 'zoom05Btn', 'zoom08Btn', 'zoom1Btn'
```

Initialize:

```js
elements.zoomControls.hidden = true;
```

Extend `makeAppHarness` options:

```js
zoomCapabilities = {},
zoomSettings = {},
zoomConstraintError = null,
zoomConstraintPromise = null,
```

Replace the track and stream with:

```js
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
```

Return `zoomConstraintCalls`.

Add:

```js
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

  assert.deepEqual(harness.zoomConstraintCalls, [{ advanced: [{ zoom: 0.8 }] }]);
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
  assert.equal(harness.elements.cameraStatus.textContent, '이 기기에서는 카메라 배율을 바꿀 수 없어요.');
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
```

- [ ] **Step 3: Run focused tests and verify missing zoom UI behavior**

Run: `node --test tests/styles.test.cjs tests/app.test.mjs`

Expected: FAIL because the zoom markup, styles, state, and constraint lifecycle are absent.

- [ ] **Step 4: Add zoom markup and styling**

Add inside `.camera-stage`, after the canvas and before countdown:

```html
<div id="zoomControls" class="camera-zoom" role="group" aria-label="카메라 배율" hidden>
    <button id="zoom05Btn" class="zoom-btn" type="button" aria-pressed="false">0.5x</button>
    <button id="zoom08Btn" class="zoom-btn" type="button" aria-pressed="false">0.8x</button>
    <button id="zoom1Btn" class="zoom-btn" type="button" aria-pressed="false">1x</button>
</div>
```

Add to `css/styles.css`:

```css
.camera-zoom {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: 16px;
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(17, 13, 17, 0.58);
    backdrop-filter: blur(10px);
    transform: translateX(-50%);
}

.zoom-btn {
    min-width: 44px;
    min-height: 44px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #fff;
    font-size: 0.82rem;
    font-weight: 800;
    cursor: pointer;
}

.zoom-btn[aria-pressed="true"] {
    background: #fff;
    color: #c41e3a;
}
```

Change `.camera-status` positioning to:

```css
top: 18px;
bottom: auto;
z-index: 3;
```

Add `z-index: 4` to `.countdown`, include `.zoom-btn:hover` in the hover transform rule, and add this mobile adjustment:

```css
.camera-zoom {
    bottom: 12px;
}
```

- [ ] **Step 5: Integrate zoom state and stream lifecycle**

Import:

```js
import {
  applyCameraZoom,
  CAMERA_ZOOM_OPTIONS,
  getSupportedZoomOptions
} from './camera-controls.js';
```

Add element bindings and value mapping:

```js
zoomControls: documentRef.getElementById('zoomControls'),
zoom05Btn: documentRef.getElementById('zoom05Btn'),
zoom08Btn: documentRef.getElementById('zoom08Btn'),
zoom1Btn: documentRef.getElementById('zoom1Btn'),
```

```js
const zoomButtons = [
  { value: 0.5, element: elements.zoom05Btn },
  { value: 0.8, element: elements.zoom08Btn },
  { value: 1, element: elements.zoom1Btn }
];
```

Extend state:

```js
supportedZooms: [],
preferredZoom: null,
currentZoom: null,
```

Add:

```js
let activeVideoTrack = null;
```

Register:

```js
zoomButtons.forEach(({ value, element }) => {
  element.addEventListener('click', () => selectZoom(value));
});
```

Add the following helpers:

```js
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

  zoomButtons.forEach(({ element }) => { element.disabled = true; });
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
```

At the beginning of `invalidatePlayback`, call `clearZoomStream()`.

At the end of `markPlaybackReady`, after `playbackReady = true`, call:

```js
configureZoom(elements.video.srcObject, generation);
```

Extend `updateCaptureControls`:

```js
zoomButtons.forEach(({ element }) => {
  element.disabled = !captureReady;
});
```

Because unsupported buttons are hidden separately, disabling all three is safe.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/camera-controls.test.mjs tests/styles.test.cjs tests/app.test.mjs`

Expected: all focused tests pass.

Run: `npm test`

Expected: all tests pass with no camera-session regressions.

- [ ] **Step 7: Commit zoom UI**

```bash
git add index.html css/styles.css js/app.js tests/app.test.mjs tests/styles.test.cjs
git commit -m "feat(app): add capability-gated camera zoom"
```

---

### Task 5: Off/3/5/7 Timer Cycle

**Files:**
- Modify: `index.html:46-49`
- Modify: `js/app.js:12-51,90-101,138-146,374-385`
- Modify: `tests/app.test.mjs:329-371,478-501,551-567,745-783`
- Modify: `tests/styles.test.cjs:21-30`

**Interfaces:**
- Consumes: `cameraSession.capture(delaySeconds)`, already valid for arbitrary positive integer seconds.
- Produces: timer state constrained to `[0, 3, 5, 7]` and a cycling button with synchronized visible/accessibility text.

- [ ] **Step 1: Replace the fixed-five-second expectations with failing cycle tests**

Replace the current countdown test with:

```js
test('cycles the timer through off, 3, 5, and 7 seconds', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.flushCamera();

  for (const [seconds, text] of [[3, '3초'], [5, '5초'], [7, '7초'], [0, '끔']]) {
    harness.elements.timerBtn.listeners.click();
    assert.equal(harness.app.getState().timerSeconds, seconds);
    assert.equal(harness.elements.timerValue.textContent, text);
    assert.equal(harness.elements.timerBtn.getAttribute('aria-label'), `타이머: ${text}`);
    assert.equal(harness.elements.timerBtn.getAttribute('aria-pressed'), String(seconds !== 0));
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
  harness.fireTimers(6);
  assert.equal(harness.elements.resultArea.hidden, true);
  harness.fireTimers(1);
  assert.equal(harness.elements.resultArea.hidden, false);
  assert.equal(harness.streamTrack.stops, 1);
  assert.equal(harness.app.getState().camera.status, 'review');
});
```

In the retake preservation test, click the timer twice and keep the expected value `5`.

In pending-upload countdown tests, fire 3 timers after a single timer-button click.

Update the static timer assertions in `tests/styles.test.cjs`:

```js
assert.match(html, /<button id="timerBtn"[^>]*aria-label="타이머: 끔"/);
```

- [ ] **Step 2: Run focused tests and verify the timer sequence fails**

Run: `node --test tests/styles.test.cjs tests/app.test.mjs`

Expected: FAIL because the button still toggles only between 0 and 5 and has the old accessible label.

- [ ] **Step 3: Implement timer cycling and synchronized labels**

Add near the rendering constants:

```js
const TIMER_OPTIONS = Object.freeze([0, 3, 5, 7]);
```

Add:

```js
function updateTimerControl() {
  const label = state.timerSeconds === 0 ? '끔' : `${state.timerSeconds}초`;
  elements.timerValue.textContent = label;
  elements.timerBtn.setAttribute('aria-label', `타이머: ${label}`);
  elements.timerBtn.setAttribute('aria-pressed', String(state.timerSeconds !== 0));
}
```

Call `updateTimerControl()` from `init()` before `cameraSession.start()`.

Replace `toggleTimer`:

```js
function toggleTimer() {
  if (cameraSession.getState().status !== 'live' || !playbackReady) return;
  const currentIndex = TIMER_OPTIONS.indexOf(state.timerSeconds);
  state.timerSeconds = TIMER_OPTIONS[(currentIndex + 1) % TIMER_OPTIONS.length];
  updateTimerControl();
}
```

Change the timer button in `index.html`:

```html
<button id="timerBtn" class="control-action timer-btn" type="button" aria-label="타이머: 끔" aria-pressed="false">
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/styles.test.cjs tests/app.test.mjs tests/camera-session.test.mjs`

Expected: timer, app, and camera-session tests pass, including exactly-once capture.

Run: `npm test`

Expected: the complete test suite passes.

- [ ] **Step 5: Commit timer presets**

```bash
git add index.html js/app.js tests/app.test.mjs tests/styles.test.cjs
git commit -m "feat(app): add configurable capture timer"
```

---

### Task 6: Full Verification, Browser QA, and Production Handoff

**Files:**
- Review: all files changed in Tasks 1-5
- Modify only if a failing test or observed browser defect is first reproduced by a focused automated test.

**Interfaces:**
- Consumes: the complete integrated feature.
- Produces: verified local implementation and an evidence-backed deployment handoff.

- [ ] **Step 1: Run repository-wide automated verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected:

- every `node:test` test passes with no warnings;
- build reports `Static site - no build needed`;
- `git diff --check` prints nothing.

- [ ] **Step 2: Review the complete feature diff**

Run:

```bash
git status --short
git diff origin/main...HEAD -- index.html css/styles.css js/app.js js/camera-controls.js js/camera-renderer.js js/frame-overlay.js tests
```

Confirm:

- no image upload, network processing, analytics, or telemetry was added;
- desktop/upload profiles remain at scale 1;
- mobile camera preview and capture share scale 0.8 and mask scale 1.25;
- zoom failure preserves the stream;
- timer and zoom async work cannot mutate review/destroyed sessions;
- all mutable camera controls lock during countdown.

- [ ] **Step 3: Start the site and inspect responsive layouts**

Run: `npm run dev`

Use browser emulation at widths 320px, 375px, and 480px:

- page loads into the camera stage without horizontal overflow;
- zoom pill has 44px targets and does not overlap status/countdown/frame rail;
- timer cycles through all four values;
- selected frames remain visible in the live canvas;
- captured review matches the final live frame treatment;
- upload fallback retains full-size frame behavior;
- unsupported zoom stays hidden.

- [ ] **Step 4: Inspect all frame assets with the mobile profile**

Select each of the 26 frames in a 375px live-camera viewport and compare the face opening before capture and in review.

Expected:

- costume artwork is visibly smaller;
- face opening remains centered and does not materially crop the face;
- no frame introduces new canvas overflow or stale prepared-mask reuse.

- [ ] **Step 5: Verify available physical-device behavior**

On an available HTTPS-served mobile browser:

- allow the front camera;
- confirm the camera permission flow still succeeds;
- if at least two candidate zoom values are exposed, switch among them and confirm the stream remains live;
- if zoom is not exposed, confirm the control stays hidden;
- capture with off, 3, 5, and 7 seconds.

Report device/browser zoom behavior as unverified when compatible physical hardware is not available.

- [ ] **Step 6: Publish only after the verified commits are present**

Push `main`, then create a production Vercel deployment from the same commit. Confirm the deployment is `READY` and verify:

```text
GET /
GET /js/app.js
GET /js/camera-controls.js
GET /assets/models/face_landmarker.task
```

Expected: HTTP 200 for all four paths. Report the production URL and the deployed commit hash.
