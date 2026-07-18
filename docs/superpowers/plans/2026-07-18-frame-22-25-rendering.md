# Frame 22 and 25 Rendering Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Frame 22's hood artwork and render both Frame 25 characters as one viewport-contained pair aligned to the nearest face slot.

**Architecture:** Extend frame configuration with optional rendering metadata while preserving the existing defaults for all normal frames. Resolve Frame 22's mobile mask override in the app, and add a paired branch inside the existing Canvas overlay drawer so live preview, capture, and uploads share one implementation.

**Tech Stack:** Browser JavaScript ES modules, Canvas 2D composition, Node.js `node:test`

## Global Constraints

- Frame 22 retains face-fit box `[210, 178, 263, 242]`.
- Frame 22 uses erase box `[213, 193, 263, 242]`.
- Frame 22 uses mobile mask scale `1`; normal mobile frames remain `1.1`.
- Frame 25 always draws one pair for the largest visible detected face.
- Frame 25 selects its left slot in the left canvas half and its right slot in the right canvas half.
- Frame 25 content bounds `[88, 152, 393, 328]` remain inside 4% viewport padding.
- Frame 25 remains upright and ignores additional face placements.
- Invalid paired metadata falls back to existing per-face rendering.
- Existing normal frames, camera zoom, timer, uploads, and background behavior remain unchanged.
- Do not modify frame PNGs or add dependencies, uploads, remote processing, analytics, or telemetry.
- Run `npm test` after JavaScript or test changes.

---

## File Structure

- Modify `js/frame-config.js` to expose calibrated Frame 22 metadata and Frame 25 paired-layout metadata.
- Modify `tests/frame-config.test.mjs` to lock the frame-specific configuration and default behavior.
- Modify `js/app.js` to resolve a selected frame's optional mobile mask override.
- Modify `tests/app.test.mjs` to verify Frame 22 uses mask scale `1` only for mobile camera composition.
- Modify `js/frame-overlay.js` to draw paired layouts once and within canvas bounds.
- Modify `tests/frame-overlay.test.mjs` to cover paired slot selection, containment, upright drawing, single draw, and fallback.

### Task 1: Add frame-specific rendering metadata

**Files:**
- Modify: `tests/frame-config.test.mjs`
- Modify: `js/frame-config.js`

**Interfaces:**
- Consumes: source-pixel boxes measured against 480-by-480 frame PNGs.
- Produces: optional `frame.mobileMaskScale: number` and `frame.layout: { mode: 'paired', contentBounds: { left, top, right, bottom }, viewportPadding: number }`.

- [ ] **Step 1: Write failing frame configuration tests**

Add these helpers and tests to `tests/frame-config.test.mjs`:

```js
function anchorFromBox([left, top, right, bottom]) {
  return {
    centerX: (left + right) / 960,
    centerY: (top + bottom) / 960,
    width: (right - left) / 480,
    height: (bottom - top) / 480
  };
}

function boundsFromBox([left, top, right, bottom]) {
  return {
    left: left / 480,
    top: top / 480,
    right: right / 480,
    bottom: bottom / 480
  };
}

test('calibrates frame 22 erase mask without changing its fit anchor', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-22');
  assert.deepEqual(frame.faceAnchor, anchorFromBox([210, 178, 263, 242]));
  assert.deepEqual(frame.maskAnchors, [anchorFromBox([213, 193, 263, 242])]);
  assert.equal(frame.mobileMaskScale, 1);
});

test('marks frame 25 as one viewport-contained paired layout', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-25');
  assert.deepEqual(frame.layout, {
    mode: 'paired',
    contentBounds: boundsFromBox([88, 152, 393, 328]),
    viewportPadding: 0.04
  });
  assert.equal(frame.maskAnchors.length, 2);
});

test('keeps frame-specific rendering metadata opt-in', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-1');
  assert.equal(frame.mobileMaskScale, undefined);
  assert.equal(frame.layout, undefined);
});
```

- [ ] **Step 2: Run frame configuration tests and verify RED**

Run:

```bash
node --test tests/frame-config.test.mjs
```

Expected: FAIL because Frame 22 still shares its fit and erase box, and neither optional rendering property exists.

- [ ] **Step 3: Add normalized bounds and optional definition metadata**

Add the bounds helper beside `anchorFromBox` in `js/frame-config.js`:

```js
function boundsFromBox([left, top, right, bottom]) {
  return {
    left: left / 480,
    top: top / 480,
    right: right / 480,
    bottom: bottom / 480
  };
}
```

Replace the Frame 22 and 25 definition rows with:

```js
['frame-22', '프레임 22', 'frame_22.png',
  [210, 178, 263, 242],
  [[213, 193, 263, 242]],
  { mobileMaskScale: 1 }],
['frame-25', '프레임 25', 'frame_25.png',
  [148, 222, 191, 262],
  [[148, 222, 191, 262], [290, 197, 350, 257]],
  {
    layout: {
      mode: 'paired',
      contentBounds: boundsFromBox([88, 152, 393, 328]),
      viewportPadding: 0.04
    }
  }],
```

Extend the definition mapper to accept and expose only supplied metadata:

```js
export const FRAMES = DEFINITIONS.map(([
  id,
  name,
  filename,
  faceBox,
  maskBoxes = [faceBox],
  rendering = {}
]) => ({
  id,
  name,
  src: `assets/frames/${filename}`,
  faceAnchor: anchorFromBox(faceBox),
  maskAnchors: maskBoxes.map(anchorFromBox),
  fitPadding: 1.08,
  ...rendering
}));
```

- [ ] **Step 4: Run frame configuration tests and verify GREEN**

Run:

```bash
node --test tests/frame-config.test.mjs
```

Expected: all frame configuration tests pass.

- [ ] **Step 5: Commit the configuration**

Inspect the complete diff and cached diff, then run:

```bash
git add js/frame-config.js tests/frame-config.test.mjs
git commit -m "fix(frames): calibrate special frame metadata"
```

### Task 2: Resolve Frame 22's mobile mask override

**Files:**
- Modify: `tests/app.test.mjs`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: optional `state.currentFrame.mobileMaskScale` from Task 1.
- Produces: `getCameraRenderingProfile()` returning `{ overlayScale: number, maskScale: number }` with the frame override applied only to mobile camera composition.

- [ ] **Step 1: Make the app harness accept selected frame images**

Add an optional `availableFrames` parameter to `makeAppHarness`:

```js
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
```

Build the harness frame map from that parameter:

```js
const frameImages = new Map(
  availableFrames.map(frame => [frame.id, makeLoadedImage(480, 480)])
);
```

- [ ] **Step 2: Write the failing Frame 22 mobile profile test**

Add this test after the normal balanced mobile profile test:

```js
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
```

- [ ] **Step 3: Run the focused app tests and verify RED**

Run:

```bash
node --test --test-name-pattern='balanced 80 percent|frame 22 mobile mask override|uploaded photos' tests/app.test.mjs
```

Expected: the new Frame 22 test fails with `1.1 !== 1`, while the normal mobile and upload tests pass.

- [ ] **Step 4: Resolve the selected frame's mobile mask scale**

Replace `getCameraRenderingProfile` in `js/app.js` with:

```js
function getCameraRenderingProfile() {
  const isMobileCamera = Boolean(mobileCameraMedia?.matches);
  const baseProfile = isMobileCamera
    ? MOBILE_CAMERA_RENDERING_PROFILE
    : DEFAULT_RENDERING_PROFILE;
  return {
    overlayScale: baseProfile.overlayScale,
    maskScale: isMobileCamera
      ? (state.currentFrame?.mobileMaskScale ?? baseProfile.maskScale)
      : baseProfile.maskScale
  };
}
```

- [ ] **Step 5: Run the focused app tests and verify GREEN**

Run:

```bash
node --test --test-name-pattern='balanced 80 percent|frame 22 mobile mask override|uploaded photos' tests/app.test.mjs
```

Expected: the three selected tests pass and non-matching tests are skipped.

- [ ] **Step 6: Commit the mobile override**

Inspect the complete diff and cached diff, then run:

```bash
git add js/app.js tests/app.test.mjs
git commit -m "fix(camera): honor frame-specific mobile masks"
```

### Task 3: Draw Frame 25 as one contained pair

**Files:**
- Modify: `tests/frame-overlay.test.mjs`
- Modify: `js/frame-overlay.js`

**Interfaces:**
- Consumes: `frame.layout.mode === 'paired'`, normalized `contentBounds`, `viewportPadding`, at least two `maskAnchors`, `context.canvas`, sorted placements, and the existing `overlayScale`.
- Produces: `drawFrameOverlays(context, preparedFrame, frame, placements, overlayScale?)` with paired layouts handled once and normal layouts unchanged.

- [ ] **Step 1: Give the frame-overlay test context canvas dimensions**

Update `makeContext` in `tests/frame-overlay.test.mjs`:

```js
function makeContext({ width = 600, height = 750 } = {}) {
  const calls = [];
  return {
    calls,
    canvas: { width, height },
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
```

- [ ] **Step 2: Write failing paired-layout tests**

Add this fixture:

```js
const pairedFrame = {
  faceAnchor: { centerX: 0.3, centerY: 0.5, width: 0.1, height: 0.1 },
  maskAnchors: [
    { centerX: 0.3, centerY: 0.5, width: 0.1, height: 0.1 },
    { centerX: 0.7, centerY: 0.5, width: 0.15, height: 0.15 }
  ],
  fitPadding: 1.08,
  layout: {
    mode: 'paired',
    contentBounds: { left: 0.1, top: 0.2, right: 0.9, bottom: 0.8 },
    viewportPadding: 0.04
  }
};
```

Add a left-slot test that also covers single draw, containment, and zero rotation:

```js
test('draws a paired frame once on the nearest left slot within viewport padding', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placements = [
    { centerX: 150, centerY: 375, width: 120, height: 225, rotation: 0.4 },
    { centerX: 450, centerY: 375, width: 100, height: 180, rotation: -0.2 }
  ];

  drawFrameOverlays(context, prepared, pairedFrame, placements, 0.8);

  const drawCalls = context.calls.filter(call => call[0] === 'drawImage');
  const scale = context.calls.find(call => call[0] === 'scale')[1];
  const margin = Math.min(context.canvas.width, context.canvas.height) * 0.04;
  const anchorX = pairedFrame.maskAnchors[0].centerX * prepared.width;
  const anchorY = pairedFrame.maskAnchors[0].centerY * prepared.height;
  assert.equal(drawCalls.length, 1);
  assert.deepEqual(context.calls.find(call => call[0] === 'translate'), ['translate', 150, 375]);
  assert.deepEqual(drawCalls[0], ['drawImage', prepared, -anchorX, -anchorY]);
  assert.equal(context.calls.some(call => call[0] === 'rotate'), false);
  assert.ok(150 + (pairedFrame.layout.contentBounds.left * 480 - anchorX) * scale >= margin);
  assert.ok(150 + (pairedFrame.layout.contentBounds.right * 480 - anchorX) * scale <= context.canvas.width - margin);
  assert.ok(375 + (pairedFrame.layout.contentBounds.top * 480 - anchorY) * scale >= margin);
  assert.ok(375 + (pairedFrame.layout.contentBounds.bottom * 480 - anchorY) * scale <= context.canvas.height - margin);
});
```

Add the right-slot selection test:

```js
test('aligns a paired frame to the right slot for a face in the right half', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placement = { centerX: 450, centerY: 375, width: 120, height: 225, rotation: 0.4 };

  drawFrameOverlays(context, prepared, pairedFrame, [placement], 0.8);

  const anchor = pairedFrame.maskAnchors[1];
  assert.deepEqual(
    context.calls.find(call => call[0] === 'drawImage'),
    ['drawImage', prepared, -anchor.centerX * 480, -anchor.centerY * 480]
  );
});
```

Add the malformed-metadata fallback test:

```js
test('falls back to per-face drawing when paired metadata is invalid', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const malformedFrame = {
    ...pairedFrame,
    layout: { mode: 'paired' }
  };
  const placements = [
    { centerX: 150, centerY: 375, width: 120, height: 225, rotation: 0.4 },
    { centerX: 450, centerY: 375, width: 100, height: 180, rotation: -0.2 }
  ];

  drawFrameOverlays(context, prepared, malformedFrame, placements, 0.8);

  assert.equal(context.calls.filter(call => call[0] === 'drawImage').length, 2);
  assert.deepEqual(
    context.calls.filter(call => call[0] === 'rotate'),
    [['rotate', 0.4], ['rotate', -0.2]]
  );
});
```

- [ ] **Step 3: Run frame overlay tests and verify RED**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: paired tests fail because the existing renderer draws once per placement, always uses `faceAnchor`, rotates each copy, and does not contain content bounds.

- [ ] **Step 4: Add paired layout validation and drawing**

Add these helpers above `drawFrameOverlays` in `js/frame-overlay.js`:

```js
function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function drawPairedFrame(context, preparedFrame, frame, placements, overlayScale) {
  const canvas = context.canvas;
  const layout = frame.layout;
  const bounds = layout?.contentBounds;
  if (
    layout?.mode !== 'paired'
    || !canvas
    || !isFinitePositive(canvas.width)
    || !isFinitePositive(canvas.height)
    || !Array.isArray(frame.maskAnchors)
    || frame.maskAnchors.length < 2
    || !bounds
    || ![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
    || bounds.left < 0
    || bounds.top < 0
    || bounds.right > 1
    || bounds.bottom > 1
    || bounds.left >= bounds.right
    || bounds.top >= bounds.bottom
    || !Number.isFinite(layout.viewportPadding)
    || layout.viewportPadding < 0
  ) return false;

  const placement = placements[0];
  if (!placement) return true;
  const anchor = placement.centerX < canvas.width / 2
    ? frame.maskAnchors[0]
    : frame.maskAnchors[1];
  const anchorX = anchor.centerX * preparedFrame.width;
  const anchorY = anchor.centerY * preparedFrame.height;
  const anchorWidth = anchor.width * preparedFrame.width;
  const anchorHeight = anchor.height * preparedFrame.height;
  const contentLeft = bounds.left * preparedFrame.width;
  const contentTop = bounds.top * preparedFrame.height;
  const contentRight = bounds.right * preparedFrame.width;
  const contentBottom = bounds.bottom * preparedFrame.height;
  if (
    ![anchorX, anchorY, anchorWidth, anchorHeight].every(isFinitePositive)
    || anchorX <= contentLeft
    || anchorX >= contentRight
    || anchorY <= contentTop
    || anchorY >= contentBottom
  ) return false;

  const faceFitScale = Math.max(
    placement.width * frame.fitPadding / anchorWidth,
    placement.height * frame.fitPadding / anchorHeight
  ) * overlayScale;
  const margin = Math.min(canvas.width, canvas.height) * layout.viewportPadding;
  const containScale = Math.min(
    (placement.centerX - margin) / (anchorX - contentLeft),
    (canvas.width - margin - placement.centerX) / (contentRight - anchorX),
    (placement.centerY - margin) / (anchorY - contentTop),
    (canvas.height - margin - placement.centerY) / (contentBottom - anchorY)
  );
  const scale = Math.min(faceFitScale, containScale);
  if (!isFinitePositive(scale)) return false;

  context.save();
  context.translate(placement.centerX, placement.centerY);
  context.scale(scale, scale);
  context.drawImage(preparedFrame, -anchorX, -anchorY);
  context.restore();
  return true;
}
```

Handle paired layouts before the existing per-face loop:

```js
export function drawFrameOverlays(
  context,
  preparedFrame,
  frame,
  placements,
  overlayScale = 1
) {
  if (
    frame.layout?.mode === 'paired'
    && drawPairedFrame(context, preparedFrame, frame, placements, overlayScale)
  ) return;

  const anchorX = frame.faceAnchor.centerX * preparedFrame.width;
  // Keep the remainder of the existing per-face implementation unchanged.
}
```

- [ ] **Step 5: Run frame overlay tests and verify GREEN**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: all frame overlay tests pass, including the unchanged normal-frame tests.

- [ ] **Step 6: Commit the paired renderer**

Inspect the complete diff and cached diff, then run:

```bash
git add js/frame-overlay.js tests/frame-overlay.test.mjs
git commit -m "fix(frames): contain paired frame artwork"
```

### Task 4: Verify the complete browser flow

**Files:**
- Verify only; no additional source files should change.

**Interfaces:**
- Consumes: all Task 1-3 behavior.
- Produces: verified repository and browser state ready for final integration.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, the static build command exits successfully, and `git diff --check` prints no errors.

- [ ] **Step 2: Run browser verification**

Run:

```bash
npm run dev
```

At a viewport width of 480px or less:

- confirm no horizontal page overflow;
- confirm frame picker, zoom, timer, and shutter layout remain unchanged;
- select Frame 22 and verify the live and captured hood preserve the original artwork when a real camera is available;
- select Frame 25 with a face in each screen half and verify both characters remain visible while the nearer slot aligns to the face;
- verify Frame 25 draws one pair even if multiple faces are detected.

If the available browser cannot expose a real camera stream, report the camera-dependent visual checks as unverified and rely only on the automated geometry assertions.

- [ ] **Step 3: Review final repository state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
```

Expected: implementation files are committed, the working tree contains no unrelated changes, and the branch is ahead of `origin/main` only by the intended design, plan, and implementation commits.
