# Fixed Cover Frames and Frames 38–49 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make frames 31 and 33 fixed full-canvas `cover` overlays, and clean and register frames 38 through 49 as ordinary face-following costumes.

**Architecture:** Extend optional frame layout metadata with a `cover` mode handled before all face-based branches. Preserve the standard renderer for frames 38–49, using native-size anchors measured from deterministic local alpha cleanup of their baked checkerboard exterior and face openings.

**Tech Stack:** Vanilla JavaScript ES modules, Canvas 2D, Node `node:test`, Node `zlib`, Python 3 with Pillow for one-time local PNG alpha processing.

## Global Constraints

- Keep photos, landmarks, prepared canvases, and composed output inside the browser.
- Add no uploads, remote processing, analytics, telemetry, services, production dependencies, or build tooling.
- Preserve camera permissions, image upload, Canvas composition, PNG download, responsive layouts, and safe fallbacks.
- Do not redraw, regenerate, recolor, or alter frame artwork outside the baked checkerboard and adjacent one-to-two-pixel neutral fringe.
- Preserve existing rendering and calibration for frames 1–30, 32, and 34–37.
- Use test-first red-green cycles for every behavior change.

---

## File Map

- `tests/frame-assets.test.mjs`: decode PNG alpha with Node built-ins and enforce native-size, transparent-opening, and opaque-artwork contracts for frames 38–49.
- `assets/frames/frame_38.png` through `assets/frames/frame_49.png`: replace baked checkerboard pixels with alpha while preserving native RGB artwork.
- `tests/frame-config.test.mjs`: enforce 49 sequential definitions, `cover` metadata, and exact native-size anchors.
- `js/frame-config.js`: register frames 38–49 and opt frames 31 and 33 into `cover` rendering.
- `tests/frame-overlay.test.mjs`: enforce fixed cover math, single-draw behavior, and invalid-dimension safety.
- `js/frame-overlay.js`: draw valid `cover` layouts once around the canvas center without consulting faces.

### Task 1: Clean and Contract-Test Frames 38–49

**Files:**
- Create: `tests/frame-assets.test.mjs`
- Modify: `assets/frames/frame_38.png`
- Modify: `assets/frames/frame_39.png`
- Modify: `assets/frames/frame_40.png`
- Modify: `assets/frames/frame_41.png`
- Modify: `assets/frames/frame_42.png`
- Modify: `assets/frames/frame_43.png`
- Modify: `assets/frames/frame_44.png`
- Modify: `assets/frames/frame_45.png`
- Modify: `assets/frames/frame_46.png`
- Modify: `assets/frames/frame_47.png`
- Modify: `assets/frames/frame_48.png`
- Modify: `assets/frames/frame_49.png`

**Interfaces:**
- Consumes: the twelve supplied opaque PNG files and Node's built-in `fs` and `zlib` modules.
- Produces: native-size RGBA PNGs whose corner and one calibrated face-opening sample are `(0,0,0,0)`, while one artwork sample has alpha `255`.

- [ ] **Step 1: Write the failing PNG alpha contract test**

Create `tests/frame-assets.test.mjs` with this non-interlaced 8-bit RGBA PNG decoder. It parses `IHDR` and concatenated `IDAT` chunks, reverses PNG filters 0–4, and exposes `alphaAt(x, y)`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function decodeRgbaPng(path) {
  const file = fs.readFileSync(path);
  assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let header;
  const imageData = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12]
      };
    }
    if (type === 'IDAT') imageData.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  assert.ok(header, `${path} IHDR`);
  assert.equal(header.bitDepth, 8, `${path} bit depth`);
  assert.equal(header.colorType, 6, `${path} RGBA color type`);
  assert.equal(header.interlace, 0, `${path} interlace`);

  const bytesPerPixel = 4;
  const stride = header.width * bytesPerPixel;
  const encoded = inflateSync(Buffer.concat(imageData));
  const pixels = Buffer.alloc(stride * header.height);
  let previous = Buffer.alloc(stride);
  let sourceOffset = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filter = encoded[sourceOffset];
    sourceOffset += 1;
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[sourceOffset + x];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)][filter];
      assert.notEqual(predictor, undefined, `${path} filter ${filter}`);
      row[x] = (raw + predictor) & 0xff;
    }
    row.copy(pixels, y * stride);
    previous = row;
    sourceOffset += stride;
  }

  return {
    width: header.width,
    height: header.height,
    rgbaAt(x, y) {
      const offset = (y * header.width + x) * bytesPerPixel;
      return [...pixels.subarray(offset, offset + bytesPerPixel)];
    },
    alphaAt(x, y) {
      return pixels[(y * header.width + x) * bytesPerPixel + 3];
    }
  };
}
```

Use these exact contracts:

```js
const FRAME_ASSETS = [
  { id: 38, size: [225, 270], face: [108, 128], art: [112, 50] },
  { id: 39, size: [206, 274], face: [93, 144], art: [103, 50] },
  { id: 40, size: [263, 279], face: [138, 160], art: [130, 70] },
  { id: 41, size: [256, 278], face: [124, 139], art: [130, 50] },
  { id: 42, size: [242, 276], face: [114, 123], art: [120, 40] },
  { id: 43, size: [249, 287], face: [121, 124], art: [50, 50] },
  { id: 44, size: [250, 337], face: [140, 180], art: [70, 70] },
  { id: 45, size: [223, 316], face: [106, 148], art: [112, 80] },
  { id: 46, size: [238, 275], face: [114, 116], art: [70, 50] },
  { id: 47, size: [273, 275], face: [140, 126], art: [135, 60] },
  { id: 48, size: [293, 282], face: [148, 137], art: [146, 60] },
  { id: 49, size: [242, 270], face: [122, 126], art: [121, 60] }
];

test('ships cleaned RGBA assets for frames 38 through 49', () => {
  FRAME_ASSETS.forEach(({ id, size, face, art }) => {
    const png = decodeRgbaPng(`assets/frames/frame_${id}.png`);
    assert.deepEqual([png.width, png.height], size, `frame-${id} size`);
    assert.deepEqual(png.rgbaAt(0, 0), [0, 0, 0, 0], `frame-${id} exterior`);
    assert.deepEqual(png.rgbaAt(...face), [0, 0, 0, 0], `frame-${id} face opening`);
    assert.equal(png.alphaAt(...art), 255, `frame-${id} artwork`);
  });
});

test('preserves the neutral panda hood in frame 43', () => {
  const png = decodeRgbaPng('assets/frames/frame_43.png');
  assert.equal(png.alphaAt(80, 70), 255);
});
```

- [ ] **Step 2: Run the asset test and verify RED**

Run: `node --test tests/frame-assets.test.mjs`

Expected: FAIL because every supplied asset has PNG color type `2` (RGB without alpha).

- [ ] **Step 3: Apply deterministic local alpha cleanup**

Use a temporary Pillow script, not a runtime dependency. Preserve every visible artwork RGB value, and set removed pixels to `(0,0,0,0)` so transparent checkerboard RGB cannot bleed during scaling. Treat a pixel as checkerboard when `max(rgb) - min(rgb) <= 10` and `min(rgb) >= 180`; use `<= 3` for frame 43 so its neutral panda hood remains protected. Flood from neutral edge pixels for the exterior and from the configured face center within its opening box for the enclosed component. Expand each removal mask by at most two pixels only where `max(rgb) - min(rgb) <= 18` and `min(rgb) >= 150`.

Use these opening boxes in native pixels:

```python
OPENINGS = {
    38: (49, 94, 166, 162),
    39: (46, 116, 141, 173),
    40: (81, 126, 196, 196),
    41: (72, 100, 177, 178),
    42: (66, 90, 163, 156),
    43: (69, 92, 174, 157),
    44: (84, 141, 195, 219),
    45: (58, 115, 154, 182),
    46: (64, 81, 163, 149),
    47: (88, 90, 191, 162),
    48: (95, 109, 202, 166),
    49: (69, 90, 175, 164),
}
```

Create `/tmp/clean_frames_38_49.py` with the following complete processing logic. The script asserts each native size before saving, preserves visible RGB values, zeros removed pixels, and saves non-interlaced RGBA PNGs:

```python
from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path('/Users/gieun/Desktop/playground/ginggingroom/ginggingroom')
SIZES = {
    38: (225, 270), 39: (206, 274), 40: (263, 279), 41: (256, 278),
    42: (242, 276), 43: (249, 287), 44: (250, 337), 45: (223, 316),
    46: (238, 275), 47: (273, 275), 48: (293, 282), 49: (242, 270),
}
OPENINGS = {
    38: (49, 94, 166, 162), 39: (46, 116, 141, 173),
    40: (81, 126, 196, 196), 41: (72, 100, 177, 178),
    42: (66, 90, 163, 156), 43: (69, 92, 174, 157),
    44: (84, 141, 195, 219), 45: (58, 115, 154, 182),
    46: (64, 81, 163, 149), 47: (88, 90, 191, 162),
    48: (95, 109, 202, 166), 49: (69, 90, 175, 164),
}

def is_checker(pixel, spread):
    return max(pixel) - min(pixel) <= spread and min(pixel) >= 180

def is_neutral_fringe(pixel):
    return max(pixel) - min(pixel) <= 18 and min(pixel) >= 150

def flood(rgb, seeds, bounds, checker_spread):
    left, top, right, bottom = bounds
    queue = deque(seeds)
    visited = set()
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not (left <= x < right and top <= y < bottom):
            continue
        if not is_checker(rgb.getpixel((x, y)), checker_spread):
            continue
        visited.add((x, y))
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return visited

for number, expected_size in SIZES.items():
    path = ROOT / f'assets/frames/frame_{number}.png'
    rgb = Image.open(path).convert('RGB')
    assert rgb.size == expected_size, (number, rgb.size, expected_size)
    width, height = rgb.size
    checker_spread = 3 if number == 43 else 10
    edge_seeds = (
        [(x, 0) for x in range(width)]
        + [(x, height - 1) for x in range(width)]
        + [(0, y) for y in range(height)]
        + [(width - 1, y) for y in range(height)]
    )
    removed = flood(rgb, edge_seeds, (0, 0, width, height), checker_spread)
    left, top, right, bottom = OPENINGS[number]
    center = ((left + right) // 2, (top + bottom) // 2)
    removed.update(flood(
        rgb,
        [center],
        (left, top, right, bottom),
        checker_spread
    ))

    base_mask = Image.new('L', rgb.size, 0)
    base_pixels = base_mask.load()
    for x, y in removed:
        base_pixels[x, y] = 255
    expanded = base_mask.filter(ImageFilter.MaxFilter(5))
    expanded_pixels = expanded.load()
    alpha = Image.new('L', rgb.size, 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if base_pixels[x, y] or (
                expanded_pixels[x, y] and is_neutral_fringe(rgb.getpixel((x, y)))
            ):
                alpha_pixels[x, y] = 0

    output = rgb.convert('RGBA')
    output.putalpha(alpha)
    output_pixels = output.load()
    for y in range(height):
        for x in range(width):
            if alpha_pixels[x, y] == 0:
                output_pixels[x, y] = (0, 0, 0, 0)
    output.save(path, format='PNG', compress_level=9, interlace=False)
```

Run: `python3 /tmp/clean_frames_38_49.py`

Expected: exit code `0` with all twelve size assertions satisfied.

- [ ] **Step 4: Run the asset contract and inspect all twelve images**

Run: `node --test tests/frame-assets.test.mjs`

Expected: PASS for all twelve native sizes and alpha samples.

Render or open every cleaned PNG over a solid contrasting background. Confirm no checkerboard or neutral fringe remains in the exterior or face opening, and that pale hands, white/pink highlights, dark ears, bows, and colored costume edges remain intact. If an edge sample fails, adjust only that frame's opening box or neutral fringe threshold and re-run the same test.

- [ ] **Step 5: Commit the asset cleanup**

```bash
git add tests/frame-assets.test.mjs assets/frames/frame_38.png assets/frames/frame_39.png assets/frames/frame_40.png assets/frames/frame_41.png assets/frames/frame_42.png assets/frames/frame_43.png assets/frames/frame_44.png assets/frames/frame_45.png assets/frames/frame_46.png assets/frames/frame_47.png assets/frames/frame_48.png assets/frames/frame_49.png
git diff --cached --stat
git commit -m "feat(frames): clean frame assets 38 through 49"
```

### Task 2: Register Fixed and Face-Following Frame Metadata

**Files:**
- Modify: `tests/frame-config.test.mjs`
- Modify: `js/frame-config.js`

**Interfaces:**
- Consumes: `anchorFromBox(box, sourceSize)` and existing `FRAMES` definition mapping.
- Produces: `FRAMES` with 49 sequential entries; frames 31 and 33 have `layout.mode === 'cover'`; frames 38–49 have no layout and use native-size anchors.

- [ ] **Step 1: Write failing configuration tests**

Update the existing collection assertions from 37 to 49 and add:

```js
const NEW_FRAME_BOXES = [
  [38, [49, 94, 166, 162], [225, 270]],
  [39, [46, 116, 141, 173], [206, 274]],
  [40, [81, 126, 196, 196], [263, 279]],
  [41, [72, 100, 177, 178], [256, 278]],
  [42, [66, 90, 163, 156], [242, 276]],
  [43, [69, 92, 174, 157], [249, 287]],
  [44, [84, 141, 195, 219], [250, 337]],
  [45, [58, 115, 154, 182], [223, 316]],
  [46, [64, 81, 163, 149], [238, 275]],
  [47, [88, 90, 191, 162], [273, 275]],
  [48, [95, 109, 202, 166], [293, 282]],
  [49, [69, 90, 175, 164], [242, 270]]
];

test('marks frames 31 and 33 as fixed cover layouts', () => {
  assert.deepEqual(FRAMES.find(({ id }) => id === 'frame-31').layout, { mode: 'cover' });
  assert.deepEqual(FRAMES.find(({ id }) => id === 'frame-33').layout, { mode: 'cover' });
});

test('normalizes frames 38 through 49 against native dimensions', () => {
  NEW_FRAME_BOXES.forEach(([number, box, size]) => {
    const frame = FRAMES.find(({ id }) => id === `frame-${number}`);
    assert.deepEqual(frame.faceAnchor, anchorFromBox(box, size));
    assert.deepEqual(frame.maskAnchors, [anchorFromBox(box, size)]);
    assert.equal(frame.layout, undefined);
  });
});
```

Replace the frame 33 contain-layout expectation with its unchanged native-size `faceAnchor`, empty `maskAnchors`, and `{ mode: 'cover' }` layout.

- [ ] **Step 2: Run the configuration tests and verify RED**

Run: `node --test tests/frame-config.test.mjs`

Expected: FAIL because only 37 frames exist, frame 31 has no layout, and frame 33 still uses `contain`.

- [ ] **Step 3: Add minimal metadata**

In `js/frame-config.js`:

- attach `{ layout: { mode: 'cover' } }` to frame 31;
- replace frame 33's `contain` slots with `{ layout: { mode: 'cover' } }`, retaining its 1080×1920 source size and empty `maskAnchors`;
- append frames 38–49 using the exact boxes and native sizes from the test;
- leave their `rendering` object empty so they use the standard renderer.

- [ ] **Step 4: Run the configuration tests and verify GREEN**

Run: `node --test tests/frame-config.test.mjs`

Expected: all configuration tests pass with 49 unique sequential source paths.

- [ ] **Step 5: Commit frame metadata**

```bash
git add tests/frame-config.test.mjs js/frame-config.js
git diff --cached
git commit -m "feat(frames): register fixed and new frame layouts"
```

### Task 3: Render Fixed Cover Frames

**Files:**
- Modify: `tests/frame-overlay.test.mjs`
- Modify: `js/frame-overlay.js`

**Interfaces:**
- Consumes: `context.canvas`, `preparedFrame.width`, `preparedFrame.height`, and `frame.layout.mode`.
- Produces: `drawCoverFrame(context, preparedFrame, frame): boolean`, returning `true` for every `cover` layout so invalid dimensions are skipped instead of falling through to face-following rendering.

- [ ] **Step 1: Write failing cover renderer tests**

Add a `coverFrame` fixture with `layout: { mode: 'cover' }`. Test a 480×480 frame on a 600×750 canvas and a 1080×1920 frame on the same canvas:

```js
test('covers the canvas once without using face placements', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placements = [
    { centerX: 100, centerY: 200, width: 80, height: 90, rotation: 0.4 },
    { centerX: 500, centerY: 300, width: 70, height: 85, rotation: -0.2 }
  ];

  drawFrameOverlays(context, prepared, coverFrame, placements, 0.5);

  assert.deepEqual(context.calls.find(call => call[0] === 'translate'), ['translate', 300, 375]);
  assert.deepEqual(context.calls.find(call => call[0] === 'scale'), ['scale', 1.5625, 1.5625]);
  assert.deepEqual(
    context.calls.filter(call => call[0] === 'drawImage'),
    [['drawImage', prepared, -240, -240]]
  );
  assert.equal(context.calls.some(call => call[0] === 'rotate'), false);
});

test('uses portrait cover sizing even when no face is detected', () => {
  const context = makeContext();
  const prepared = { width: 1080, height: 1920 };
  drawFrameOverlays(context, prepared, coverFrame, [], 0.5);
  assert.deepEqual(context.calls.find(call => call[0] === 'scale'), ['scale', 600 / 1080, 600 / 1080]);
  assert.equal(context.calls.filter(call => call[0] === 'drawImage').length, 1);
});

test('skips an invalid cover frame without falling through', () => {
  const context = makeContext();
  drawFrameOverlays(context, { width: 0, height: 480 }, coverFrame, [{
    centerX: 300, centerY: 375, width: 100, height: 120, rotation: 0.3
  }]);
  assert.equal(context.calls.some(call => call[0] === 'drawImage'), false);
  assert.equal(context.calls.some(call => call[0] === 'rotate'), false);
});
```

- [ ] **Step 2: Run the overlay tests and verify RED**

Run: `node --test tests/frame-overlay.test.mjs`

Expected: FAIL because the standard branch draws once per placement and draws nothing for an empty placement list.

- [ ] **Step 3: Implement the minimal cover branch**

Add:

```js
function drawCoverFrame(context, preparedFrame, frame) {
  if (frame.layout?.mode !== 'cover') return false;
  const canvas = context.canvas;
  if (
    !canvas
    || !isFinitePositive(canvas.width)
    || !isFinitePositive(canvas.height)
    || !isFinitePositive(preparedFrame.width)
    || !isFinitePositive(preparedFrame.height)
  ) return true;

  const scale = Math.max(
    canvas.width / preparedFrame.width,
    canvas.height / preparedFrame.height
  );
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(scale, scale);
  context.drawImage(
    preparedFrame,
    -preparedFrame.width / 2,
    -preparedFrame.height / 2
  );
  context.restore();
  return true;
}
```

Call it first in `drawFrameOverlays`:

```js
if (drawCoverFrame(context, preparedFrame, frame)) return;
```

- [ ] **Step 4: Run focused and full renderer tests**

Run: `node --test tests/frame-overlay.test.mjs`

Expected: all cover, standard, paired, anchored, and contain tests pass.

Run: `npm test`

Expected: the complete repository suite passes with zero failures.

- [ ] **Step 5: Commit cover rendering**

```bash
git add tests/frame-overlay.test.mjs js/frame-overlay.js
git diff --cached
git commit -m "feat(frames): render fixed cover overlays"
```

### Task 4: Full Verification

**Files:**
- Verify: `assets/frames/frame_38.png` through `assets/frames/frame_49.png`
- Verify: `js/frame-config.js`
- Verify: `js/frame-overlay.js`
- Verify: `tests/frame-assets.test.mjs`
- Verify: `tests/frame-config.test.mjs`
- Verify: `tests/frame-overlay.test.mjs`

**Interfaces:**
- Consumes: the complete static app, local browser camera/upload paths, capture canvas, and PNG download.
- Produces: verified selector ordering and matching preview, capture, and download behavior.

- [ ] **Step 1: Run repository verification**

Run: `npm test`

Expected: all tests pass with zero failures.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Start the app**

Run: `npm run dev`

Expected: the static server listens on `http://localhost:3000` without errors.

- [ ] **Step 3: Verify frames 31 and 33**

With both a camera source and an uploaded image, select frames 31 and 33. Confirm each fills the entire canvas, stays centered and upright as faces move, draws once with zero or multiple faces, crops only outside the canvas, and matches the captured/downloaded PNG.

- [ ] **Step 4: Verify frames 38–49**

Confirm selector order 38 through 49, transparent thumbnails, no exterior or face-opening checkerboard, no neutral fringe on contrasting dark and bright photos, intact pale and dark artwork, and face-following position/scale/rotation for every new costume. Confirm preview, capture, and PNG download agree.

- [ ] **Step 5: Review final scope**

Run: `git status --short`

Expected: no unrelated files are staged or modified. The design and implementation-plan commits plus the three focused implementation commits contain the complete feature.
