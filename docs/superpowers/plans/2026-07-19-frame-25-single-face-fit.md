# Frame 25 Single-Face Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Frame 25's duplicated miniature portrait and fit the nearest character opening around the original face like normal frames.

**Architecture:** Replace Frame 25's portrait metadata with an opt-in paired face-scale mode. The paired renderer will keep its nearest-anchor selection but use the full face-fit scale for Frame 25, draw the prepared artwork once over the original source, and remove all portrait-copy helpers and metadata.

**Tech Stack:** Browser JavaScript ES modules, Canvas 2D composition, Node.js `node:test`

## Global Constraints

- The camera or uploaded photo remains the only source of face pixels.
- Frame 25 selects the left opening in the left canvas half and the right opening in the right canvas half.
- The selected opening uses the full existing face-fit scale.
- The unselected character may be partially cropped or outside the canvas.
- Frame 25 remains upright and ignores additional placements.
- Paired layouts without `scaleMode: 'face'` retain viewport-contained behavior.
- Normal frames, mobile overlay scale, camera zoom, timer, uploads, capture, download, and background behavior remain unchanged.
- Do not modify frame PNGs or add dependencies, uploads, remote processing, analytics, or telemetry.
- Keep photos, landmarks, masks, and composed canvases in the browser.
- Run `npm test` after JavaScript or test changes.

---

## File Structure

- Modify `js/frame-config.js` to replace Frame 25's `portraitInset` metadata with `scaleMode: 'face'`.
- Modify `tests/frame-config.test.mjs` to lock the new opt-in metadata and removal of portrait insertion.
- Modify `js/frame-overlay.js` to select face-fit scale for opted-in paired layouts and remove portrait-copy code.
- Modify `tests/frame-overlay.test.mjs` to replace portrait tests with single-source face-fit and contained-pair regression tests.
- Add and commit `docs/superpowers/plans/2026-07-19-frame-25-single-face-fit.md` as the execution record.

### Task 1: Configure Frame 25 for paired face fitting

**Files:**
- Modify: `tests/frame-config.test.mjs`
- Modify: `js/frame-config.js`

**Interfaces:**
- Consumes: the existing `frame.layout` object.
- Produces: `frame.layout.scaleMode: 'face'` for Frame 25 and no `portraitInset`.

- [ ] **Step 1: Replace the Frame 25 configuration assertion**

Replace the current Frame 25 layout test in `tests/frame-config.test.mjs` with:

```js
test('marks frame 25 as a paired single-face layout', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-25');
  assert.deepEqual(frame.layout, {
    mode: 'paired',
    contentBounds: boundsFromBox([88, 152, 393, 328]),
    viewportPadding: 0.04,
    scaleMode: 'face'
  });
  assert.equal(frame.layout.portraitInset, undefined);
  assert.equal(frame.maskAnchors.length, 2);
});
```

Keep the existing normal-frame opt-in assertion unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/frame-config.test.mjs
```

Expected: FAIL because Frame 25 still exposes `portraitInset` and has no
`scaleMode`.

- [ ] **Step 3: Replace the Frame 25 metadata**

Change only Frame 25's layout in `js/frame-config.js` to:

```js
{
  layout: {
    mode: 'paired',
    contentBounds: boundsFromBox([88, 152, 393, 328]),
    viewportPadding: 0.04,
    scaleMode: 'face'
  }
}
```

- [ ] **Step 4: Run the configuration tests and verify GREEN**

Run:

```bash
node --test tests/frame-config.test.mjs
```

Expected: all Frame configuration tests pass.

- [ ] **Step 5: Inspect and commit the configuration**

Run:

```bash
git diff --check
git diff -- js/frame-config.js tests/frame-config.test.mjs
git add js/frame-config.js tests/frame-config.test.mjs
git diff --cached --check
git diff --cached -- js/frame-config.js tests/frame-config.test.mjs
git commit -m "fix(frames): configure frame 25 face fitting"
```

### Task 2: Remove portrait copying and use the full face-fit scale

**Files:**
- Modify: `tests/frame-overlay.test.mjs`
- Modify: `js/frame-overlay.js`

**Interfaces:**
- Consumes:
  - `drawFrameOverlays(context, preparedFrame, frame, placements, overlayScale)`
  - `frame.layout.scaleMode`
  - the first sorted placement and nearest paired anchor
- Produces:
  - one prepared-frame draw using face-fit scale when `scaleMode === 'face'`
  - the existing contained scale for other paired layouts
  - no temporary portrait canvas or copied face draw

- [ ] **Step 1: Remove portrait-only test helpers**

In `tests/frame-overlay.test.mjs`:

- remove `clip()` from `makeContext`;
- remove `portraitPairedFrame`;
- remove `makePortraitCanvas`;
- remove the six tests whose names begin with or cover:
  - `insets one central face portrait`;
  - `insets the portrait into the left opening`;
  - `keeps a portrait source crop`;
  - `draws the contained pair when portrait canvas creation`;
  - `draws the contained pair when the portrait context`;
  - `ignores invalid portrait metadata`.

Update the prepared-mask tests so they keep invalid-scale normalization but no
longer require portrait-only canvas metadata:

```js
test('erases every configured face placeholder in an offscreen canvas', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };
  const prepared = prepareFrameImage(
    frameImage,
    frame,
    { createCanvas: () => canvas }
  );
  assert.equal(prepared, canvas);
  assert.deepEqual(context.calls, [
    ['drawImage', frameImage, 0, 0, 480, 480],
    ['beginPath'],
    ['ellipse', 240, 192, 48, 48, 0, 0, Math.PI * 2],
    ['fill', 'destination-out'],
    ['beginPath'],
    ['ellipse', 336, 192, 24, 24, 0, 0, Math.PI * 2],
    ['fill', 'destination-out']
  ]);
  assert.equal(context.globalCompositeOperation, 'source-over');
});
```

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
```

```js
test('normalizes an invalid prepared mask scale to one', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };

  prepareFrameImage(frameImage, frame, {
    createCanvas: () => canvas,
    maskScale: Number.NaN
  });

  assert.deepEqual(
    context.calls.filter(call => call[0] === 'ellipse'),
    [
      ['ellipse', 240, 192, 48, 48, 0, 0, Math.PI * 2],
      ['ellipse', 336, 192, 24, 24, 0, 0, Math.PI * 2]
    ]
  );
});
```

- [ ] **Step 2: Add a failing paired face-fit test**

Add this fixture after `pairedFrame`:

```js
const faceFitPairedFrame = {
  ...pairedFrame,
  layout: {
    ...pairedFrame.layout,
    scaleMode: 'face'
  }
};
```

Add:

```js
test('uses the full face-fit scale for a paired single-face layout', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placement = {
    centerX: 450,
    centerY: 375,
    width: 120,
    height: 225,
    rotation: 0.4
  };
  const anchor = faceFitPairedFrame.maskAnchors[1];
  const expectedScale = Math.max(
    placement.width * faceFitPairedFrame.fitPadding / (anchor.width * prepared.width),
    placement.height * faceFitPairedFrame.fitPadding / (anchor.height * prepared.height)
  ) * 0.8;

  drawFrameOverlays(
    context,
    prepared,
    faceFitPairedFrame,
    [
      placement,
      { centerX: 150, centerY: 375, width: 100, height: 180, rotation: -0.2 }
    ],
    0.8
  );

  assert.deepEqual(
    context.calls.find(call => call[0] === 'scale'),
    ['scale', expectedScale, expectedScale]
  );
  assert.deepEqual(
    context.calls.filter(call => call[0] === 'drawImage'),
    [[
      'drawImage',
      prepared,
      -anchor.centerX * prepared.width,
      -anchor.centerY * prepared.height
    ]]
  );
  assert.equal(context.calls.some(call => call[0] === 'ellipse'), false);
});
```

The existing `draws a paired frame once on the nearest left slot within
viewport padding` test remains unchanged and protects the default contained
behavior.

- [ ] **Step 3: Run the overlay tests and verify RED**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: the new face-fit test fails because the renderer still caps scale at
the viewport-contain scale. All retained normal, mask, contained-pair, nearest
anchor, and fallback tests pass.

- [ ] **Step 4: Remove portrait-only prepared metadata**

In `prepareFrameImage`, remove:

```js
canvas.maskScale = resolvedMaskScale;
```

Keep `resolvedMaskScale` and continue using it for ellipse radii.

- [ ] **Step 5: Remove portrait-copy helpers**

Delete these functions from `js/frame-overlay.js`:

```js
function createBrowserCanvas() {
  return typeof document === 'undefined'
    ? null
    : document.createElement('canvas');
}
```

Delete the complete `captureFacePortrait` and `drawPortraitInset` function
declarations.

- [ ] **Step 6: Simplify the paired renderer signature**

Replace:

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

with:

```js
function drawPairedFrame(context, preparedFrame, frame, placements, overlayScale) {
```

- [ ] **Step 7: Select face-fit scale for opted-in paired layouts**

Replace:

```js
const scale = Math.min(faceFitScale, containScale);
if (!isFinitePositive(scale)) return false;

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

with:

```js
const scale = layout.scaleMode === 'face'
  ? faceFitScale
  : Math.min(faceFitScale, containScale);
if (!isFinitePositive(scale)) return false;
```

- [ ] **Step 8: Restore the public drawer to its original five arguments**

Replace the signature and paired call with:

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
```

Keep the generic per-face implementation unchanged.

- [ ] **Step 9: Run focused overlay tests and verify GREEN**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: all frame-overlay tests pass.

- [ ] **Step 10: Run camera and app regressions**

Run:

```bash
node --test tests/camera-renderer.test.mjs tests/app.test.mjs
```

Expected: all source ordering, mirrored placement, mobile frame scale, upload,
capture, timer, zoom, and retake tests pass without caller changes.

- [ ] **Step 11: Inspect and commit the renderer**

Run:

```bash
git diff --check
git diff -- js/frame-overlay.js tests/frame-overlay.test.mjs
git add js/frame-overlay.js tests/frame-overlay.test.mjs
git diff --cached --check
git diff --cached -- js/frame-overlay.js tests/frame-overlay.test.mjs
git commit -m "fix(frames): fit frame 25 to one source face"
```

### Task 3: Commit the implementation plan

**Files:**
- Create: `docs/superpowers/plans/2026-07-19-frame-25-single-face-fit.md`

**Interfaces:**
- Consumes: the approved single-face design.
- Produces: a tracked implementation and verification record.

- [ ] **Step 1: Review the complete plan**

Run:

```bash
sed -n '1,900p' docs/superpowers/plans/2026-07-19-frame-25-single-face-fit.md
rg -n 'T[B]D|T[O]DO|F[I]XME|implement l[a]ter|fill i[n]|appropriate error handl[i]ng|similar to t[a]sk|write tests f[o]r' docs/superpowers/plans/2026-07-19-frame-25-single-face-fit.md
git diff --check
```

Expected: the complete plan is readable, the placeholder search prints no
matches, and the whitespace check prints no errors.

- [ ] **Step 2: Commit the plan separately**

Run:

```bash
git add docs/superpowers/plans/2026-07-19-frame-25-single-face-fit.md
git diff --cached --check
git diff --cached -- docs/superpowers/plans/2026-07-19-frame-25-single-face-fit.md
git commit -m "docs(frames): add frame 25 single-face plan"
```

### Task 4: Verify the complete camera flow

**Files:**
- Verify only; no source files should change.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: a verified local `main` ready for an authorized GitHub push and Vercel deployment.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: the full test suite passes with zero failures, the static build exits
successfully, and the whitespace check prints no errors.

- [ ] **Step 2: Start the local app**

Run:

```bash
npm run dev
```

Expected: the server reports `http://localhost:3000/`.

- [ ] **Step 3: Verify Frame 25 at a 390-by-844 viewport**

With a real camera when available:

- select Frame 25;
- confirm only the original camera face is visible;
- confirm the nearest character opening surrounds the full face;
- confirm no miniature copied face appears;
- move the face between canvas halves when practical and confirm nearest-anchor
  selection;
- confirm the selected character may crop the unselected character as designed;
- confirm the frame rail, shutter, timer, upload control, and page have no
  horizontal overflow.

If real camera access is unavailable, report the camera-dependent visual checks
as unverified and rely on the automated scale, draw-count, and anchor tests.

- [ ] **Step 4: Verify capture and retake**

- capture Frame 25 and confirm the result matches the live single-face
  composition;
- retake and confirm the same behavior resumes;
- confirm no network upload or new remote processing was introduced.

- [ ] **Step 5: Review the final repository state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -10
```

Expected: the working tree is clean and `main` is ahead of `origin/main` only by
the approved design, plan, and implementation commits.

- [ ] **Step 6: Push and verify production only when authorized**

After explicit user authorization:

```bash
git push origin main
```

Then verify that the Vercel production copies of `js/frame-config.js` and
`js/frame-overlay.js` match the pushed local files before reporting deployment
complete.
