# Frames 27–37 Multi-Face Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register frames 27–37, make their intended backgrounds and openings genuinely transparent, place multiple detected faces into frames 28 and 29, and preserve frame 33's complete portrait layout around its center screen.

**Architecture:** Extend frame configuration with native source dimensions and optional normalized portrait slots. Keep ordinary overlays unchanged, while `frame-overlay.js` adds one anchored multi-slot renderer and one centered contain renderer that crop only from the already-rendered local canvas. Prepared PNG assets supply clean alpha for thumbnails and runtime composition.

**Tech Stack:** HTML5 Canvas 2D, vanilla JavaScript ES modules, `node:test`, existing browser face placements, PNG/JPEG frame assets.

## Global Constraints

- Preserve camera permissions, image upload, Canvas composition, PNG download, responsive layouts, and safe fallback behavior when face detection or frame loading fails.
- Keep photos, landmarks, face crops, and composed canvases inside the browser; add no uploads, remote processing, analytics, or telemetry.
- Add no production dependencies, services, build tooling, or face segmentation.
- Do not alter frames 1–26 or their calibration.
- Preserve the native dimensions and aspect ratio of frames 27–37.
- A one-person photo uses only the approved representative slot in frames 28 and 29; unused slots reveal the original source.
- Frame 33 uses centered `contain` sizing and never crops its top or bottom.

## File Structure

- Modify `assets/frames/frame_33.jpeg` into `assets/frames/frame_33.png`: preserve 1080×1920 artwork and replace only the center white screen with alpha.
- Modify `assets/frames/frame_34.png` through `frame_37.png`: replace baked checkerboard exterior and enclosed face windows with alpha.
- Modify `js/frame-config.js`: register frames 27–37, normalize by native dimensions, and describe optional portrait slots.
- Modify `js/frame-overlay.js`: prepare ellipse/rectangle masks and render anchored or contained portrait slots.
- Modify `tests/frame-config.test.mjs`: validate all new definitions, native-size normalization, and slot ordering.
- Modify `tests/frame-overlay.test.mjs`: validate mask shapes, assignment, crop transforms, contain behavior, and fallbacks.

---

### Task 1: Clean the New Frame Assets

**Files:**
- Replace: `assets/frames/frame_33.jpeg` with `assets/frames/frame_33.png`
- Modify: `assets/frames/frame_34.png`
- Modify: `assets/frames/frame_35.png`
- Modify: `assets/frames/frame_36.png`
- Modify: `assets/frames/frame_37.png`

**Interfaces:**
- Consumes: user-supplied raster artwork and the calibrated opening boxes in the approved design.
- Produces: RGBA PNG assets whose transparent pixels can be used directly by `<img>` thumbnails and Canvas rendering.

- [ ] **Step 1: Record source metadata before editing**

Run:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha assets/frames/frame_33.jpeg assets/frames/frame_{34,35,36,37}.png
```

Expected: frame 33 is 1080×1920 without alpha; frames 34–37 match 216×350, 204×340, 236×296, and 217×340 and report no usable alpha.

- [ ] **Step 2: Produce exact transparent edits without redrawing artwork**

For frame 33, preserve every opaque pixel outside the connected center screen, convert to RGBA PNG, and clear only the white screen region enclosed by the pink border. Use `[198,660,893,1110]` only as the search boundary; follow the connected white region so foreground decorations survive.

For frames 34–37, clear edge-connected neutral checkerboard pixels plus the enclosed neutral face-window component at these boxes:

```text
34: [58,173,157,248]
35: [37,165,159,242]
36: [69,105,170,193]
37: [46,150,156,229]
```

Keep native dimensions, do not regenerate colored material, and clean only the one-pixel neutral matte at each alpha boundary.

- [ ] **Step 3: Verify the edited binaries**

Run:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha assets/frames/frame_{33,34,35,36,37}.png
file assets/frames/frame_{33,34,35,36,37}.png
```

Expected: all five files are RGBA PNGs with alpha and retain the exact source dimensions. Visually inspect each at original detail against the source artwork; no checkerboard, center-screen white, colored border damage, or halo may remain.

- [ ] **Step 4: Record the asset commit boundary**

Do not commit without explicit user approval. When approved, stage only the five edited PNGs and the removal of `frame_33.jpeg`, then use:

```bash
git commit -m "fix(frames): prepare transparent frame assets"
```

---

### Task 2: Register Native Sizes and Portrait Slots

**Files:**
- Modify: `tests/frame-config.test.mjs`
- Modify: `js/frame-config.js`

**Interfaces:**
- Consumes: native-pixel boxes and asset paths from Task 1.
- Produces: `FRAMES` entries with `faceAnchor`, `maskAnchors`, and optional `layout: { mode, slots }`; all coordinates are normalized to the source asset's width and height.

- [ ] **Step 1: Write failing configuration tests**

Add a size-aware test helper and assertions equivalent to:

```js
function anchorFromBox([left, top, right, bottom], [width = 480, height = 480] = []) {
  return {
    centerX: (left + right) / (2 * width),
    centerY: (top + bottom) / (2 * height),
    width: (right - left) / width,
    height: (bottom - top) / height
  };
}

test('registers all 37 frames in numeric order', () => {
  assert.equal(FRAMES.length, 37);
  assert.deepEqual(
    FRAMES.map(frame => frame.id),
    Array.from({ length: 37 }, (_, index) => `frame-${index + 1}`)
  );
  assert.equal(FRAMES.find(frame => frame.id === 'frame-33').src, 'assets/frames/frame_33.png');
});

test('normalizes portrait frame geometry against native dimensions', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-33');
  assert.deepEqual(frame.faceAnchor, anchorFromBox([198, 660, 893, 1110], [1080, 1920]));
  assert.equal(frame.layout.mode, 'contain');
  assert.deepEqual(frame.layout.slots, [{
    ...anchorFromBox([198, 660, 893, 1110], [1080, 1920]),
    shape: 'rect'
  }]);
});

test('orders representative and secondary slots for multi-face frames', () => {
  const frame28 = FRAMES.find(({ id }) => id === 'frame-28');
  const frame29 = FRAMES.find(({ id }) => id === 'frame-29');
  assert.equal(frame28.layout.mode, 'anchored');
  assert.equal(frame29.layout.mode, 'anchored');
  assert.deepEqual(frame28.layout.slots.map(slot => slot.centerY), [
    anchorFromBox([193,119,285,211]).centerY,
    anchorFromBox([193,23,281,105]).centerY,
    anchorFromBox([197,216,286,307]).centerY
  ]);
  assert.deepEqual(frame29.layout.slots.map(slot => slot.centerX), [
    anchorFromBox([159,148,294,245]).centerX,
    anchorFromBox([105,300,199,366]).centerX,
    anchorFromBox([270,316,355,391]).centerX
  ]);
});
```

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:

```bash
node --test tests/frame-config.test.mjs
```

Expected: FAIL because only 26 frames exist and native-size slot metadata is absent.

- [ ] **Step 3: Implement size-aware definitions**

Change the geometry helpers to accept `[sourceWidth, sourceHeight]`, add a `slotsFromBoxes` helper, extend definition tuples with `sourceSize = [480, 480]`, and add frames 27–37. Preserve old anchors exactly by defaulting to 480×480.

Core implementation shape:

```js
function anchorFromBox([left, top, right, bottom], [sourceWidth, sourceHeight] = [480, 480]) {
  return {
    centerX: (left + right) / (2 * sourceWidth),
    centerY: (top + bottom) / (2 * sourceHeight),
    width: (right - left) / sourceWidth,
    height: (bottom - top) / sourceHeight
  };
}

function slotsFromBoxes(boxes, sourceSize, shape = 'ellipse') {
  return boxes.map(box => ({ ...anchorFromBox(box, sourceSize), shape }));
}
```

Frame 28 slot order is middle/top/bottom. Frame 29 slot order is upper/lower-left/lower-right. Frame 33 uses `frame_33.png`, `mode: 'contain'`, one rectangular slot, and an empty `maskAnchors` list so runtime preparation cannot erase overlapping screen decorations. Frames 34–37 use their native source sizes.

- [ ] **Step 4: Run targeted and full tests**

Run:

```bash
node --test tests/frame-config.test.mjs
npm test
```

Expected: configuration tests pass; existing frame 1–26 calibration tests remain green.

- [ ] **Step 5: Record the configuration commit boundary**

Do not commit without explicit user approval. When approved:

```bash
git commit -m "feat(frames): register frames 27 through 37"
```

---

### Task 3: Support Shape-Aware Frame Preparation

**Files:**
- Modify: `tests/frame-overlay.test.mjs`
- Modify: `js/frame-overlay.js`

**Interfaces:**
- Consumes: `maskAnchors` with optional `shape: 'rect' | 'ellipse'`; absent shape means ellipse.
- Produces: `prepareFrameImage(frameImage, frame, options)` that erases each configured mask without touching an already-transparent asset when the mask list is empty.

- [ ] **Step 1: Add a failing rectangle-mask test**

Extend the fake context with `rect(...args)` and add:

```js
test('erases rectangular placeholders with edge cleanup', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  prepareFrameImage(
    { naturalWidth: 200, naturalHeight: 400 },
    {
      maskAnchors: [{ centerX: 0.5, centerY: 0.5, width: 0.4, height: 0.25, shape: 'rect' }]
    },
    { createCanvas: () => canvas }
  );
  assert.deepEqual(
    context.calls.find(call => call[0] === 'rect'),
    ['rect', 58.5, 148.5, 83, 103]
  );
});
```

- [ ] **Step 2: Verify the new test fails**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: FAIL because preparation always calls `ellipse`.

- [ ] **Step 3: Implement shape-aware mask paths**

Add one helper and call it inside `prepareFrameImage`:

```js
function traceAnchorPath(context, anchor, canvasWidth, canvasHeight, scale = 1, cleanup = 0) {
  const width = anchor.width * scale * canvasWidth;
  const height = anchor.height * scale * canvasHeight;
  const centerX = anchor.centerX * canvasWidth;
  const centerY = anchor.centerY * canvasHeight;
  context.beginPath();
  if (anchor.shape === 'rect') {
    context.rect(
      centerX - width / 2 - cleanup,
      centerY - height / 2 - cleanup,
      width + cleanup * 2,
      height + cleanup * 2
    );
    return;
  }
  context.ellipse(
    centerX,
    centerY,
    width / 2 + cleanup,
    height / 2 + cleanup,
    0,
    0,
    Math.PI * 2
  );
}
```

Use `frame.maskAnchors ?? []` so frame 33's prepared alpha asset is valid without an erase mask.

- [ ] **Step 4: Run overlay and full tests**

Run:

```bash
node --test tests/frame-overlay.test.mjs
npm test
```

Expected: all existing ellipse and edge-cleanup assertions plus the rectangle assertion pass.

- [ ] **Step 5: Record the preparation commit boundary**

Do not commit without explicit user approval. When approved:

```bash
git commit -m "feat(frames): support shaped frame masks"
```

---

### Task 4: Render Anchored and Contained Portrait Slots

**Files:**
- Modify: `tests/frame-overlay.test.mjs`
- Modify: `js/frame-overlay.js`

**Interfaces:**
- Consumes: prepared frame canvas, normalized slots, output-canvas placements already sorted largest-first, and an optional `{ createCanvas }` test seam.
- Produces: `drawFrameOverlays(context, preparedFrame, frame, placements, overlayScale, options)` with standard, paired, anchored, and contain branches.

- [ ] **Step 1: Add failing assignment and rendering tests**

Create injected offscreen canvases with recorded 2D calls. Test these observable outcomes:

```js
test('draws one anchored frame and only one portrait for one face', () => {
  drawFrameOverlays(context, prepared, anchoredFrame, [largestFace], 1, { createCanvas });
  assert.equal(frameDrawCalls().length, 1);
  assert.equal(portraitDrawCalls().length, 1);
  assert.equal(context.calls.some(call => call[0] === 'rotate'), false);
});

test('assigns remaining faces left to right and caps portraits at slot count', () => {
  drawFrameOverlays(
    context,
    prepared,
    anchoredFrame,
    [largestFace, rightFace, leftFace, extraFace],
    1,
    { createCanvas }
  );
  assert.deepEqual(sourceCentersUsedByPortraitCrops(), [
    largestFace.centerX,
    leftFace.centerX,
    rightFace.centerX
  ]);
  assert.equal(portraitDrawCalls().length, 3);
});

test('contains the complete portrait frame in the output canvas', () => {
  drawFrameOverlays(context, portraitPrepared, containFrame, [largestFace], 0.8, { createCanvas });
  assert.deepEqual(mainScaleCall(), ['scale', 0.390625, 0.390625]);
  assert.deepEqual(mainTranslateCall(), ['translate', 300, 375]);
});

test('falls back to standard drawing for malformed slot metadata', () => {
  drawFrameOverlays(context, prepared, malformedSlotFrame, [largestFace]);
  assert.equal(context.calls.filter(call => call[0] === 'rotate').length, 1);
});
```

For the contain example, a 1080×1920 frame in a 600×750 canvas uses `min(600/1080, 750/1920) = 0.390625`; mobile costume `overlayScale` does not shrink a contain layout.

- [ ] **Step 2: Run the overlay tests and confirm failure**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: FAIL because anchored and contain layout modes do not exist.

- [ ] **Step 3: Implement deterministic face assignment**

Add:

```js
function assignPlacementsToSlots(placements, slotCount) {
  if (!placements[0] || slotCount < 1) return [];
  return [
    placements[0],
    ...placements.slice(1).sort((a, b) => a.centerX - b.centerX)
  ].slice(0, slotCount);
}
```

Validate finite positive slot geometry before entering a slot branch.

- [ ] **Step 4: Implement aspect-preserving portrait crops**

Snapshot `context.canvas` before any overlay draw. For each assigned face, calculate a source rectangle centered on the placement and expanded to the slot aspect ratio. Clip a frame-local portrait canvas with the slot's ellipse or rectangle, then call the nine-argument `drawImage(snapshot, sx, sy, sw, sh, dx, dy, dw, dh)`. Clamp source rectangles to snapshot bounds without changing their aspect ratio.

Core cover math:

```js
function getFaceCrop(placement, destinationAspect, sourceWidth, sourceHeight, padding) {
  let width = placement.width * padding;
  let height = placement.height * padding;
  if (width / height < destinationAspect) width = height * destinationAspect;
  else height = width / destinationAspect;
  width = Math.min(width, sourceWidth);
  height = Math.min(height, sourceHeight);
  return {
    left: Math.min(Math.max(placement.centerX - width / 2, 0), sourceWidth - width),
    top: Math.min(Math.max(placement.centerY - height / 2, 0), sourceHeight - height),
    width,
    height
  };
}
```

- [ ] **Step 5: Implement anchored rendering**

Use slot zero and placement zero to calculate the same face-fit scale as standard overlays, but omit rotation. Draw the frame-local portrait layer first and the prepared frame second inside one `save`/`translate`/`scale`/`restore` transform. Return `true` only when the slot metadata and transform are valid.

- [ ] **Step 6: Implement contained rendering**

Use `Math.min(canvas.width / preparedFrame.width, canvas.height / preparedFrame.height)`, translate to the output-canvas center, and draw portrait layer then prepared frame around the prepared-frame center. Ignore the costume `overlayScale` for this branch so frame 33 is maximized while remaining fully visible.

- [ ] **Step 7: Preserve dispatch and fallback order**

In `drawFrameOverlays`, attempt modes in this order:

```js
if (frame.layout?.mode === 'paired' && drawPairedFrame(...)) return;
if (frame.layout?.mode === 'anchored' && drawAnchoredSlots(..., options)) return;
if (frame.layout?.mode === 'contain' && drawContainedSlots(..., options)) return;
drawStandardFrames(...);
```

If `document` is unavailable and no `createCanvas` dependency is supplied, return `false` from a slot helper so Node tests and non-browser callers fail safely instead of throwing.

- [ ] **Step 8: Run targeted and full tests**

Run:

```bash
node --test tests/frame-overlay.test.mjs
npm test
```

Expected: all slot tests pass and every prior standard/paired overlay test remains green.

- [ ] **Step 9: Record the rendering commit boundary**

Do not commit without explicit user approval. When approved:

```bash
git commit -m "feat(frames): render multi-face portrait slots"
```

---

### Task 5: Full Integration and Browser Verification

**Files:**
- Verify: `assets/frames/frame_27.png` through `assets/frames/frame_37.png`
- Verify: `js/frame-config.js`
- Verify: `js/frame-overlay.js`
- Verify: `tests/frame-config.test.mjs`
- Verify: `tests/frame-overlay.test.mjs`

**Interfaces:**
- Consumes: all Task 1–4 deliverables.
- Produces: a verified selector, live preview, uploaded-photo composition, capture, and PNG download for frames 27–37.

- [ ] **Step 1: Run repository-wide static verification**

Run:

```bash
git diff --check
npm test
```

Expected: no whitespace errors and the full test suite passes.

- [ ] **Step 2: Start the development server**

Run:

```bash
npm run dev
```

Expected: the static server listens at `http://localhost:3000` with no startup error.

- [ ] **Step 3: Verify the frame selector and alpha assets**

Open the app and confirm frame buttons 27–37 appear in order. Thumbnails 33–37 must show the selector background through transparent pixels, not a white or checkerboard matte.

- [ ] **Step 4: Verify single- and multi-face behavior**

With uploaded one-, two-, and three-face photos:

- frame 28 uses middle/top/bottom slot order;
- frame 29 uses upper/lower-left/lower-right slot order;
- one face fills only the representative slot;
- two and three faces occupy separate slots;
- extra faces do not duplicate the full artwork;
- unused slots reveal the base photo.

- [ ] **Step 5: Verify frame 33 and standard frames**

Confirm frame 33 preserves the entire 1080×1920 composition on the 600×750 canvas, centers the selected face in the transparent screen, and matches capture/download. Spot-check frames 27, 30–32, and 34–37 against one face and verify ordinary face following remains intact.

- [ ] **Step 6: Verify live-camera parity when permission is available**

Confirm preview, shutter capture, review, and PNG download agree. If camera permission or hardware is unavailable, report that exact limitation and retain uploaded-photo browser verification.

- [ ] **Step 7: Review the final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- js/frame-config.js js/frame-overlay.js tests/frame-config.test.mjs tests/frame-overlay.test.mjs
```

Expected: only the approved new assets, frame configuration, overlay renderer, focused tests, and implementation plan are in feature scope; `.gitignore` and the older untracked plan remain untouched.

- [ ] **Step 8: Record the final commit boundary**

Do not commit without explicit user approval. If the user asks to commit after verification, use the commit-workflow skill to inspect and stage the remaining coherent scope.
