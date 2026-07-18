# Frame 25 Face Portrait Inset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep both Frame 25 characters visible while inserting the detected person's central facial features into the nearest character opening.

**Architecture:** Add opt-in portrait metadata to Frame 25, retain the resolved erase-mask scale on prepared frame canvases, and extend the paired overlay renderer with a browser-local portrait snapshot step. The source crop is copied before any artwork is drawn, clipped into only the selected opening, and covered by the existing contained pair so live preview, capture, and uploads share the same composition path.

**Tech Stack:** Browser JavaScript ES modules, Canvas 2D composition, Node.js `node:test`

## Global Constraints

- Frame 25 keeps both characters visible as one viewport-contained pair.
- Frame 25 continues selecting the left slot in the left canvas half and the right slot in the right canvas half.
- Frame 25 uses a square central-face crop with `sourceWidthScale: 1.35`.
- The portrait target matches the selected anchor, contained pair scale, and prepared mask scale.
- Only the selected opening receives a portrait; the unselected opening keeps the underlying background.
- Portrait pixels are copied before frame artwork and the pair is drawn on top.
- Mobile Frame 25 uses mask scale `1.1`; desktop and uploaded photos use `1`.
- Invalid or unavailable portrait composition skips only the portrait and still draws one contained pair.
- Invalid paired metadata retains the existing generic per-face fallback.
- Normal frames, camera zoom, timer, uploads, capture, and background behavior remain unchanged.
- Do not modify frame PNGs or add dependencies, uploads, remote processing, analytics, or telemetry.
- Keep photos, landmarks, masks, temporary portraits, and composed canvases in the browser.
- Run `npm test` after JavaScript or test changes.

---

## File Structure

- Modify `js/frame-config.js` to opt only Frame 25 into a `portraitInset` layout.
- Modify `tests/frame-config.test.mjs` to lock the portrait configuration and opt-in default.
- Modify `js/frame-overlay.js` to retain prepared mask scale, snapshot a bounded central face crop, clip it into the selected opening, and preserve current fallbacks.
- Modify `tests/frame-overlay.test.mjs` to cover mask metadata, crop geometry, left and right targets, draw order, single insertion, failure fallback, and unchanged normal rendering.
- Add and commit `docs/superpowers/plans/2026-07-19-frame-25-face-portrait-inset.md` as the execution record.

### Task 1: Opt Frame 25 into portrait insertion

**Files:**
- Modify: `tests/frame-config.test.mjs`
- Modify: `js/frame-config.js`

**Interfaces:**
- Consumes: the existing `frame.layout` object from Frame 25.
- Produces: `frame.layout.portraitInset: { sourceWidthScale: number }`, present only when a paired layout should insert a portrait.

- [ ] **Step 1: Write the failing configuration assertions**

Replace the expected Frame 25 layout in `tests/frame-config.test.mjs` with:

```js
test('marks frame 25 as one viewport-contained paired portrait layout', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-25');
  assert.deepEqual(frame.layout, {
    mode: 'paired',
    contentBounds: boundsFromBox([88, 152, 393, 328]),
    viewportPadding: 0.04,
    portraitInset: {
      sourceWidthScale: 1.35
    }
  });
  assert.equal(frame.maskAnchors.length, 2);
});
```

Keep the existing opt-in assertion unchanged:

```js
test('keeps frame-specific rendering metadata opt-in', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-1');
  assert.equal(frame.mobileMaskScale, undefined);
  assert.equal(frame.layout, undefined);
});
```

- [ ] **Step 2: Run the frame configuration tests and verify RED**

Run:

```bash
node --test tests/frame-config.test.mjs
```

Expected: FAIL because Frame 25's layout does not contain `portraitInset`.

- [ ] **Step 3: Add the Frame 25 portrait metadata**

Update only the Frame 25 layout in `js/frame-config.js`:

```js
{
  layout: {
    mode: 'paired',
    contentBounds: boundsFromBox([88, 152, 393, 328]),
    viewportPadding: 0.04,
    portraitInset: {
      sourceWidthScale: 1.35
    }
  }
}
```

- [ ] **Step 4: Run the frame configuration tests and verify GREEN**

Run:

```bash
node --test tests/frame-config.test.mjs
```

Expected: all frame configuration tests pass.

- [ ] **Step 5: Commit the configuration**

Inspect the complete diff and cached diff, then run:

```bash
git add js/frame-config.js tests/frame-config.test.mjs
git commit -m "fix(frames): configure frame 25 portrait inset"
```

### Task 2: Retain the resolved prepared-frame mask scale

**Files:**
- Modify: `tests/frame-overlay.test.mjs`
- Modify: `js/frame-overlay.js`

**Interfaces:**
- Consumes: `prepareFrameImage(frameImage, frame, { createCanvas, maskScale })`.
- Produces: the same drawable canvas with `canvas.maskScale: number`, normalized to a finite positive value and defaulting to `1`.

- [ ] **Step 1: Add failing prepared-mask metadata assertions**

In the existing erase test, add:

```js
assert.equal(prepared.maskScale, 1);
```

Update the expanded-mask test to retain the returned canvas and assert its scale:

```js
test('expands face masks and records the resolved mask scale', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };

  const prepared = prepareFrameImage(frameImage, frame, {
    createCanvas: () => canvas,
    maskScale: 1.25
  });

  assert.equal(prepared.maskScale, 1.25);
  assert.deepEqual(
    context.calls.filter(call => call[0] === 'ellipse'),
    [
      ['ellipse', 240, 192, 60, 60, 0, 0, Math.PI * 2],
      ['ellipse', 336, 192, 30, 30, 0, 0, Math.PI * 2]
    ]
  );
});
```

Add an invalid-scale regression test:

```js
test('normalizes an invalid prepared mask scale to one', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };

  const prepared = prepareFrameImage(frameImage, frame, {
    createCanvas: () => canvas,
    maskScale: Number.NaN
  });

  assert.equal(prepared.maskScale, 1);
  assert.deepEqual(
    context.calls.filter(call => call[0] === 'ellipse'),
    [
      ['ellipse', 240, 192, 48, 48, 0, 0, Math.PI * 2],
      ['ellipse', 336, 192, 24, 24, 0, 0, Math.PI * 2]
    ]
  );
});
```

- [ ] **Step 2: Run the focused mask tests and verify RED**

Run:

```bash
node --test --test-name-pattern='erases every|records the resolved|invalid prepared mask' tests/frame-overlay.test.mjs
```

Expected: FAIL because prepared canvases do not expose `maskScale`, and invalid scale currently produces invalid ellipse radii.

- [ ] **Step 3: Normalize and retain the mask scale**

Update the beginning of `prepareFrameImage` in `js/frame-overlay.js`:

```js
export function prepareFrameImage(frameImage, frame, {
  createCanvas = () => document.createElement('canvas'),
  maskScale = 1
} = {}) {
  const canvas = createCanvas();
  const resolvedMaskScale = isFinitePositive(maskScale) ? maskScale : 1;
  canvas.width = frameImage.naturalWidth;
  canvas.height = frameImage.naturalHeight;
  canvas.maskScale = resolvedMaskScale;
  const context = canvas.getContext('2d');
```

Use `resolvedMaskScale` for both ellipse radii:

```js
context.ellipse(
  anchor.centerX * canvas.width,
  anchor.centerY * canvas.height,
  anchor.width * resolvedMaskScale * canvas.width / 2,
  anchor.height * resolvedMaskScale * canvas.height / 2,
  0,
  0,
  Math.PI * 2
);
```

The existing `isFinitePositive` function declaration is hoisted and can be used
by `prepareFrameImage` without moving it.

- [ ] **Step 4: Run the focused mask tests and verify GREEN**

Run:

```bash
node --test --test-name-pattern='erases every|records the resolved|invalid prepared mask' tests/frame-overlay.test.mjs
```

Expected: the three selected tests pass.

- [ ] **Step 5: Run all frame-overlay tests**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: all frame-overlay tests pass.

- [ ] **Step 6: Commit the prepared-frame metadata**

Inspect the complete diff and cached diff, then run:

```bash
git add js/frame-overlay.js tests/frame-overlay.test.mjs
git commit -m "fix(frames): retain prepared mask scale"
```

### Task 3: Insert the central face portrait into the selected opening

**Files:**
- Modify: `tests/frame-overlay.test.mjs`
- Modify: `js/frame-overlay.js`

**Interfaces:**
- Consumes:
  - `frame.layout.portraitInset.sourceWidthScale: number`
  - `preparedFrame.maskScale: number`
  - `context.canvas` containing source pixels before overlays
  - the first sorted placement and selected paired anchor
  - optional `drawFrameOverlays(..., { createCanvas })` test seam
- Produces:
  - one bounded square portrait snapshot
  - one clipped portrait draw in the selected opening
  - one contained paired-frame draw on top
  - the current paired draw when portrait insertion is unavailable

- [ ] **Step 1: Extend the test Canvas context and add portrait fixtures**

Add `clip` to `makeContext` in `tests/frame-overlay.test.mjs`:

```js
clip() { calls.push(['clip']); },
```

Add these fixtures after `pairedFrame`:

```js
const portraitPairedFrame = {
  ...pairedFrame,
  layout: {
    ...pairedFrame.layout,
    portraitInset: {
      sourceWidthScale: 1.35
    }
  }
};

function makePortraitCanvas() {
  const calls = [];
  const context = {
    drawImage(...args) { calls.push(['drawImage', ...args]); }
  };
  return {
    calls,
    width: 0,
    height: 0,
    getContext: () => context
  };
}
```

- [ ] **Step 2: Write the failing central-crop and right-opening test**

Add:

```js
test('insets one central face portrait into the selected right opening before the pair', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480, maskScale: 1.1 };
  const portrait = makePortraitCanvas();
  const placement = {
    centerX: 450,
    centerY: 375,
    width: 120,
    height: 225,
    rotation: 0.4
  };

  drawFrameOverlays(
    context,
    prepared,
    portraitPairedFrame,
    [
      placement,
      { centerX: 150, centerY: 375, width: 100, height: 180, rotation: -0.2 }
    ],
    0.8,
    { createCanvas: () => portrait }
  );

  assert.deepEqual(portrait.calls, [
    ['drawImage', context.canvas, 369, 294, 162, 162, 0, 0, 162, 162]
  ]);

  const pairScale = context.calls.find(call => call[0] === 'scale')[1];
  const anchor = portraitPairedFrame.maskAnchors[1];
  const targetWidth = anchor.width * prepared.width * pairScale * prepared.maskScale;
  const targetHeight = anchor.height * prepared.height * pairScale * prepared.maskScale;
  assert.deepEqual(
    context.calls.find(call => call[0] === 'ellipse'),
    [
      'ellipse',
      placement.centerX,
      placement.centerY,
      targetWidth / 2,
      targetHeight / 2,
      0,
      0,
      Math.PI * 2
    ]
  );

  const drawCalls = context.calls.filter(call => call[0] === 'drawImage');
  assert.deepEqual(drawCalls, [
    [
      'drawImage',
      portrait,
      placement.centerX - targetWidth / 2,
      placement.centerY - targetHeight / 2,
      targetWidth,
      targetHeight
    ],
    [
      'drawImage',
      prepared,
      -anchor.centerX * prepared.width,
      -anchor.centerY * prepared.height
    ]
  ]);
  assert.ok(context.calls.indexOf(drawCalls[0]) < context.calls.indexOf(drawCalls[1]));
  assert.equal(context.calls.filter(call => call[0] === 'clip').length, 1);
});
```

- [ ] **Step 3: Write the failing left-opening and edge-crop tests**

Add:

```js
test('insets the portrait into the left opening for a face in the left half', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const portrait = makePortraitCanvas();
  const placement = {
    centerX: 150,
    centerY: 375,
    width: 120,
    height: 225,
    rotation: 0.4
  };

  drawFrameOverlays(
    context,
    prepared,
    portraitPairedFrame,
    [placement],
    0.8,
    { createCanvas: () => portrait }
  );

  const pairScale = context.calls.find(call => call[0] === 'scale')[1];
  const anchor = portraitPairedFrame.maskAnchors[0];
  assert.deepEqual(
    context.calls.find(call => call[0] === 'ellipse'),
    [
      'ellipse',
      placement.centerX,
      placement.centerY,
      anchor.width * prepared.width * pairScale / 2,
      anchor.height * prepared.height * pairScale / 2,
      0,
      0,
      Math.PI * 2
    ]
  );
  assert.equal(context.calls.filter(call => call[0] === 'clip').length, 1);
});

test('keeps a portrait source crop square and inside the canvas edge', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480, maskScale: 1 };
  const portrait = makePortraitCanvas();
  const placement = {
    centerX: 30,
    centerY: 50,
    width: 120,
    height: 225,
    rotation: 0
  };

  drawFrameOverlays(
    context,
    prepared,
    portraitPairedFrame,
    [placement],
    0.8,
    { createCanvas: () => portrait }
  );

  assert.deepEqual(portrait.calls, [
    ['drawImage', context.canvas, 0, 0, 162, 162, 0, 0, 162, 162]
  ]);
});
```

- [ ] **Step 4: Write failing portrait-fallback tests**

Add:

```js
test('draws the contained pair when portrait canvas creation is unavailable', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480, maskScale: 1.1 };
  const placement = {
    centerX: 450,
    centerY: 375,
    width: 120,
    height: 225,
    rotation: 0.4
  };

  drawFrameOverlays(
    context,
    prepared,
    portraitPairedFrame,
    [placement],
    0.8,
    { createCanvas: () => null }
  );

  assert.deepEqual(
    context.calls.filter(call => call[0] === 'drawImage'),
    [[
      'drawImage',
      prepared,
      -portraitPairedFrame.maskAnchors[1].centerX * prepared.width,
      -portraitPairedFrame.maskAnchors[1].centerY * prepared.height
    ]]
  );
  assert.equal(context.calls.some(call => call[0] === 'clip'), false);
});

test('draws the contained pair when the portrait context is unavailable', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480, maskScale: 1.1 };
  const placement = {
    centerX: 450,
    centerY: 375,
    width: 120,
    height: 225,
    rotation: 0.4
  };

  drawFrameOverlays(
    context,
    prepared,
    portraitPairedFrame,
    [placement],
    0.8,
    {
      createCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => null
      })
    }
  );

  assert.equal(context.calls.filter(call => call[0] === 'drawImage').length, 1);
  assert.equal(context.calls.some(call => call[0] === 'clip'), false);
});

test('ignores invalid portrait metadata without invoking the canvas factory', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480, maskScale: 1 };
  const invalidPortraitFrame = {
    ...portraitPairedFrame,
    layout: {
      ...portraitPairedFrame.layout,
      portraitInset: { sourceWidthScale: 0 }
    }
  };

  drawFrameOverlays(
    context,
    prepared,
    invalidPortraitFrame,
    [{ centerX: 150, centerY: 375, width: 120, height: 225, rotation: 0 }],
    0.8,
    { createCanvas: () => { throw new Error('must not run'); } }
  );

  assert.equal(context.calls.filter(call => call[0] === 'drawImage').length, 1);
  assert.equal(context.calls.some(call => call[0] === 'clip'), false);
});
```

- [ ] **Step 5: Run the frame-overlay tests and verify RED**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: the new portrait tests fail because the current paired renderer does
not create a crop, clip a selected opening, or draw a portrait before the pair.
Existing normal, contained-pair, and invalid-paired-metadata tests still pass.

- [ ] **Step 6: Add a safe browser-canvas factory**

Add above `drawPairedFrame` in `js/frame-overlay.js`:

```js
function createBrowserCanvas() {
  return typeof document === 'undefined'
    ? null
    : document.createElement('canvas');
}
```

- [ ] **Step 7: Add bounded portrait snapshotting**

Add:

```js
function captureFacePortrait(context, placement, sourceWidthScale, createCanvas) {
  const sourceCanvas = context.canvas;
  if (
    !sourceCanvas
    || !isFinitePositive(sourceCanvas.width)
    || !isFinitePositive(sourceCanvas.height)
    || !Number.isFinite(placement?.centerX)
    || !Number.isFinite(placement?.centerY)
    || !isFinitePositive(placement?.width)
    || !isFinitePositive(sourceWidthScale)
    || typeof createCanvas !== 'function'
  ) return null;

  const cropSide = Math.min(
    placement.width * sourceWidthScale,
    sourceCanvas.width,
    sourceCanvas.height
  );
  if (!isFinitePositive(cropSide)) return null;
  const cropLeft = Math.min(
    Math.max(placement.centerX - cropSide / 2, 0),
    sourceCanvas.width - cropSide
  );
  const cropTop = Math.min(
    Math.max(placement.centerY - cropSide / 2, 0),
    sourceCanvas.height - cropSide
  );

  try {
    const portrait = createCanvas();
    if (!portrait) return null;
    portrait.width = Math.max(1, Math.round(cropSide));
    portrait.height = Math.max(1, Math.round(cropSide));
    const portraitContext = portrait.getContext?.('2d');
    if (!portraitContext) return null;
    portraitContext.drawImage(
      sourceCanvas,
      cropLeft,
      cropTop,
      cropSide,
      cropSide,
      0,
      0,
      portrait.width,
      portrait.height
    );
    return portrait;
  } catch {
    return null;
  }
}
```

- [ ] **Step 8: Add selected-opening portrait drawing**

Add:

```js
function drawPortraitInset(
  context,
  portrait,
  placement,
  anchorWidth,
  anchorHeight,
  pairScale,
  preparedMaskScale
) {
  const targetWidth = anchorWidth * pairScale * preparedMaskScale;
  const targetHeight = anchorHeight * pairScale * preparedMaskScale;
  if (!isFinitePositive(targetWidth) || !isFinitePositive(targetHeight)) return;

  context.save();
  context.beginPath();
  context.ellipse(
    placement.centerX,
    placement.centerY,
    targetWidth / 2,
    targetHeight / 2,
    0,
    0,
    Math.PI * 2
  );
  context.clip();
  context.drawImage(
    portrait,
    placement.centerX - targetWidth / 2,
    placement.centerY - targetHeight / 2,
    targetWidth,
    targetHeight
  );
  context.restore();
}
```

- [ ] **Step 9: Integrate portrait insertion before the paired artwork**

Extend `drawPairedFrame` to accept `createCanvas`:

```js
function drawPairedFrame(
  context,
  preparedFrame,
  frame,
  placements,
  overlayScale,
  createCanvas
) {
```

Immediately after validating `scale`, add:

```js
const portraitConfig = layout.portraitInset;
if (isFinitePositive(portraitConfig?.sourceWidthScale)) {
  const portrait = captureFacePortrait(
    context,
    placement,
    portraitConfig.sourceWidthScale,
    createCanvas
  );
  if (portrait) {
    const preparedMaskScale = isFinitePositive(preparedFrame.maskScale)
      ? preparedFrame.maskScale
      : 1;
    drawPortraitInset(
      context,
      portrait,
      placement,
      anchorWidth,
      anchorHeight,
      scale,
      preparedMaskScale
    );
  }
}
```

Extend the public drawer signature and paired call:

```js
export function drawFrameOverlays(
  context,
  preparedFrame,
  frame,
  placements,
  overlayScale = 1,
  { createCanvas = createBrowserCanvas } = {}
) {
  if (
    frame.layout?.mode === 'paired'
    && drawPairedFrame(
      context,
      preparedFrame,
      frame,
      placements,
      overlayScale,
      createCanvas
    )
  ) return;
```

Keep the existing generic per-face implementation unchanged.

- [ ] **Step 10: Run the frame-overlay tests and verify GREEN**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: all mask, portrait, paired fallback, and normal overlay tests pass.

- [ ] **Step 11: Run the camera and app regression tests**

Run:

```bash
node --test tests/camera-renderer.test.mjs tests/app.test.mjs
```

Expected: all camera mapping, live composition, capture, mobile mask, upload, and
app interaction tests pass without caller changes.

- [ ] **Step 12: Commit the portrait renderer**

Inspect the complete diff and cached diff, then run:

```bash
git add js/frame-overlay.js tests/frame-overlay.test.mjs
git commit -m "fix(frames): inset face portrait in paired frame"
```

### Task 4: Commit the implementation plan

**Files:**
- Create: `docs/superpowers/plans/2026-07-19-frame-25-face-portrait-inset.md`

**Interfaces:**
- Consumes: the approved design and completed implementation steps.
- Produces: a repository-tracked implementation and verification record.

- [ ] **Step 1: Review the plan document**

Run:

```bash
sed -n '1,900p' docs/superpowers/plans/2026-07-19-frame-25-face-portrait-inset.md
rg -n 'T[B]D|T[O]DO|F[I]XME|implement l[a]ter|fill i[n]|appropriate error handl[i]ng|similar to t[a]sk|write tests f[o]r' docs/superpowers/plans/2026-07-19-frame-25-face-portrait-inset.md
git diff --check
```

Expected: the complete plan is readable, the placeholder search prints no
matches, and the whitespace check prints no errors.

- [ ] **Step 2: Commit the plan separately**

Inspect the cached diff, then run:

```bash
git add docs/superpowers/plans/2026-07-19-frame-25-face-portrait-inset.md
git commit -m "docs(frames): add frame 25 portrait inset plan"
```

### Task 5: Verify the complete camera flow

**Files:**
- Verify only; no additional source files should change.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: a verified `main` state ready for GitHub push and Vercel automatic deployment.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: the full test suite passes with zero failures, the static build command
exits successfully, and the whitespace check prints no errors.

- [ ] **Step 2: Start the local app**

Run:

```bash
npm run dev
```

Expected: the static server reports `http://localhost:3000/`.

- [ ] **Step 3: Verify the mobile live camera**

At a 390-by-844 viewport with real camera access when available:

- select Frame 25 with the face in the left half and confirm the portrait appears only in the left opening;
- move the face into the right half and confirm the portrait moves only to the right opening;
- confirm eyes, nose, and mouth are visible naturally rather than only the nose;
- confirm both characters remain visible and upright;
- confirm additional detected faces do not add another portrait or pair;
- confirm the frame rail, shutter, timer, upload control, and page remain free of horizontal overflow.

If real camera access is unavailable, report these camera-dependent visual
checks as unverified and rely on the automated crop and target assertions.

- [ ] **Step 4: Verify camera capture and upload**

- capture Frame 25 and confirm the result matches the last live composition;
- retake and confirm the portrait behavior resumes;
- when a local test image is available, upload it and confirm its unmirrored face
  crop appears in the selected opening;
- confirm the image remains local and no network upload is introduced.

- [ ] **Step 5: Review final repository state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -10
```

Expected: the working tree is clean, `main` is ahead of `origin/main` only by the
approved design, plan, and implementation commits, and no frame assets or
unrelated files changed.

- [ ] **Step 6: Push and verify production only when authorized**

After explicit user authorization:

```bash
git push origin main
```

Then verify that the Vercel production copies of `js/frame-config.js` and
`js/frame-overlay.js` match the pushed local files before reporting deployment
complete.
