# Frame Edge Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove pale alpha fringes from all 26 frame assets and prevent white placeholder pixels from remaining around runtime-generated face openings.

**Architecture:** Apply a one-time, offline alpha/color decontamination to the tracked PNG assets, then add a fixed 1.5-source-pixel overscan to the existing Canvas face-mask preparation. Keep the browser rendering pipeline, frame anchors, cache keys, placement logic, and downloaded composition unchanged.

**Tech Stack:** Vanilla JavaScript ES modules, Canvas 2D, `node:test`, Python 3 with locally available Pillow 12.1.1 for the one-time offline asset transform.

## Global Constraints

- Keep all user photos, landmarks, masks, and composed canvases in the browser.
- Add no uploads, remote processing, analytics, telemetry, services, build tooling, or production dependency.
- Preserve all 26 frame filenames as `assets/frames/frame_01.png` through `frame_26.png`.
- Preserve every frame as a 480×480 RGBA PNG with a nonempty transparent background.
- Do not add outlines, shadows, sharpening, or recoloring.
- Preserve frame placement, scale profiles, mask anchors, camera permissions, uploads, composition, PNG download, responsive behavior, and ML failure fallbacks.
- Preserve unrelated user changes and stage only the files named by each task.
- Run `npm test` after the JavaScript and asset changes.

---

## File Map

- Modify `tests/frame-overlay.test.mjs`: assert the exact 1.5-pixel face-mask overscan for default, scaled, invalid-scale, and multi-opening preparation.
- Modify `js/frame-overlay.js`: define and apply the internal face-mask edge-cleanup allowance.
- Modify `assets/frames/frame_01.png` through `assets/frames/frame_26.png`: replace pale matte edge pixels with decontaminated, one-pixel-contracted, softly feathered alpha edges.
- Create temporarily outside the repository at `/tmp/ginggingroom-clean-frame-edges.py`: generate and validate cleaned assets without adding a runtime or repository dependency.

### Task 1: Overscan Runtime Face Masks

**Files:**
- Modify: `tests/frame-overlay.test.mjs:54-112`
- Modify: `js/frame-overlay.js:1-31`

**Interfaces:**
- Consumes: `prepareFrameImage(frameImage, frame, { createCanvas, maskScale })` and each normalized `frame.maskAnchors` entry.
- Produces: the same prepared Canvas return value, with every ellipse radius expanded by the internal `FACE_MASK_EDGE_CLEANUP_PX = 1.5` constant.

- [ ] **Step 1: Change the focused expectations so they require the 1.5-pixel overscan**

In `tests/frame-overlay.test.mjs`, replace the first three preparation tests with:

```js
test('erases every configured face placeholder with a 1.5 pixel edge cleanup', () => {
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
    ['ellipse', 240, 192, 49.5, 49.5, 0, 0, Math.PI * 2],
    ['fill', 'destination-out'],
    ['beginPath'],
    ['ellipse', 336, 192, 25.5, 25.5, 0, 0, Math.PI * 2],
    ['fill', 'destination-out']
  ]);
  assert.equal(context.globalCompositeOperation, 'source-over');
});

test('composes mask scaling and edge cleanup independently', () => {
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
      ['ellipse', 240, 192, 61.5, 61.5, 0, 0, Math.PI * 2],
      ['ellipse', 336, 192, 31.5, 31.5, 0, 0, Math.PI * 2]
    ]
  );
});

test('normalizes an invalid mask scale before applying edge cleanup', () => {
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
      ['ellipse', 240, 192, 49.5, 49.5, 0, 0, Math.PI * 2],
      ['ellipse', 336, 192, 25.5, 25.5, 0, 0, Math.PI * 2]
    ]
  );
});
```

- [ ] **Step 2: Run the focused tests and confirm the new expectations fail**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: FAIL in the first three tests because the actual radii are still `48`, `24`, `60`, and `30` without the 1.5-pixel allowance. The later drawing tests should continue to pass.

- [ ] **Step 3: Add the fixed cleanup allowance to frame preparation**

At the top of `js/frame-overlay.js`, add the constant and apply it after the scaled radius calculation:

```js
const FACE_MASK_EDGE_CLEANUP_PX = 1.5;

export function prepareFrameImage(frameImage, frame, {
  createCanvas = () => document.createElement('canvas'),
  maskScale = 1
} = {}) {
  const canvas = createCanvas();
  const resolvedMaskScale = isFinitePositive(maskScale) ? maskScale : 1;
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
      anchor.width * resolvedMaskScale * canvas.width / 2
        + FACE_MASK_EDGE_CLEANUP_PX,
      anchor.height * resolvedMaskScale * canvas.height / 2
        + FACE_MASK_EDGE_CLEANUP_PX,
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

Do not add a call-site option or change `js/app.js`; the constant must not affect prepared-frame cache keys.

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run:

```bash
node --test tests/frame-overlay.test.mjs
```

Expected: all frame-overlay tests PASS.

- [ ] **Step 5: Review and commit only the runtime mask change**

Run:

```bash
git diff --check
git diff -- tests/frame-overlay.test.mjs js/frame-overlay.js
git add tests/frame-overlay.test.mjs js/frame-overlay.js
git diff --cached --check
git diff --cached --stat
git commit -m "fix(frames): clean runtime mask edges"
```

Expected: one commit containing only `tests/frame-overlay.test.mjs` and `js/frame-overlay.js`.

### Task 2: Decontaminate the 26 Stored PNG Boundaries

**Files:**
- Modify: `assets/frames/frame_01.png`
- Modify: `assets/frames/frame_02.png`
- Modify: `assets/frames/frame_03.png`
- Modify: `assets/frames/frame_04.png`
- Modify: `assets/frames/frame_05.png`
- Modify: `assets/frames/frame_06.png`
- Modify: `assets/frames/frame_07.png`
- Modify: `assets/frames/frame_08.png`
- Modify: `assets/frames/frame_09.png`
- Modify: `assets/frames/frame_10.png`
- Modify: `assets/frames/frame_11.png`
- Modify: `assets/frames/frame_12.png`
- Modify: `assets/frames/frame_13.png`
- Modify: `assets/frames/frame_14.png`
- Modify: `assets/frames/frame_15.png`
- Modify: `assets/frames/frame_16.png`
- Modify: `assets/frames/frame_17.png`
- Modify: `assets/frames/frame_18.png`
- Modify: `assets/frames/frame_19.png`
- Modify: `assets/frames/frame_20.png`
- Modify: `assets/frames/frame_21.png`
- Modify: `assets/frames/frame_22.png`
- Modify: `assets/frames/frame_23.png`
- Modify: `assets/frames/frame_24.png`
- Modify: `assets/frames/frame_25.png`
- Modify: `assets/frames/frame_26.png`
- Create temporarily: `/tmp/ginggingroom-clean-frame-edges.py`
- Generate temporarily: `/tmp/ginggingroom-frame-edge-cleanup-20260720/`

**Interfaces:**
- Consumes: the 26 tracked 480×480 RGBA frame PNGs and Pillow's `Image`, `ImageFilter.MinFilter(3)`, and `ImageFilter.GaussianBlur(0.5)`.
- Produces: exactly 26 validated 480×480 RGBA PNGs with transparent pixels, nonempty artwork, and locally decontaminated partial-alpha RGB values.

- [ ] **Step 1: Confirm the offline transformation dependency and baseline asset contract**

Run:

```bash
python3 -c 'import PIL; print(PIL.__version__)'
python3 -c 'from pathlib import Path; from PIL import Image; paths=sorted(Path("assets/frames").glob("frame_*.png")); assert len(paths)==26; [(_ for _ in ()).throw(AssertionError(f"{p}: {im.size} {im.mode}")) if im.size!=(480,480) or im.mode!="RGBA" else None for p in paths for im in [Image.open(p)]]; print("validated 26 source frames")'
```

Expected: Pillow prints `12.1.1` (or a compatible installed version), followed by `validated 26 source frames`.

- [ ] **Step 2: Create the isolated one-time cleaner**

Create `/tmp/ginggingroom-clean-frame-edges.py` with `apply_patch` using this complete content:

```python
#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageFilter

FRAME_SIZE = (480, 480)
FRAME_COUNT = 26
INTERIOR_ALPHA = 224
COLOR_SEARCH_RADIUS = 2
ALPHA_CONTRACTION_SIZE = 3
ALPHA_FEATHER_RADIUS = 0.5


def expected_names() -> list[str]:
    return [f"frame_{index:02d}.png" for index in range(1, FRAME_COUNT + 1)]


def nearest_interior_rgb(
    pixels,
    x: int,
    y: int,
    width: int,
    height: int,
) -> tuple[int, int, int] | None:
    candidates: list[tuple[int, int, int, int, tuple[int, int, int]]] = []
    for offset_y in range(-COLOR_SEARCH_RADIUS, COLOR_SEARCH_RADIUS + 1):
        source_y = y + offset_y
        if source_y < 0 or source_y >= height:
            continue
        for offset_x in range(-COLOR_SEARCH_RADIUS, COLOR_SEARCH_RADIUS + 1):
            source_x = x + offset_x
            if source_x < 0 or source_x >= width:
                continue
            red, green, blue, alpha = pixels[source_x, source_y]
            if alpha < INTERIOR_ALPHA:
                continue
            candidates.append((
                offset_x * offset_x + offset_y * offset_y,
                abs(offset_x) + abs(offset_y),
                source_y,
                source_x,
                (red, green, blue),
            ))
    if not candidates:
        return None
    candidates.sort(key=lambda candidate: candidate[:4])
    return candidates[0][4]


def clean_frame(source: Image.Image) -> Image.Image:
    rgba = source.convert("RGBA")
    if rgba.size != FRAME_SIZE:
        raise ValueError(f"expected {FRAME_SIZE}, got {rgba.size}")

    source_alpha = rgba.getchannel("A")
    cleaned_alpha = source_alpha.filter(
        ImageFilter.MinFilter(ALPHA_CONTRACTION_SIZE)
    ).filter(
        ImageFilter.GaussianBlur(ALPHA_FEATHER_RADIUS)
    )
    source_pixels = rgba.load()
    alpha_pixels = cleaned_alpha.load()
    output = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    output_pixels = output.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            red, green, blue, _source_alpha = source_pixels[x, y]
            alpha = alpha_pixels[x, y]
            if 0 < alpha < 255:
                interior = nearest_interior_rgb(
                    source_pixels,
                    x,
                    y,
                    width,
                    height,
                )
                if interior is not None:
                    red, green, blue = interior
            output_pixels[x, y] = (red, green, blue, alpha)

    return output


def validate_frame(image: Image.Image, path: Path) -> None:
    if image.size != FRAME_SIZE or image.mode != "RGBA":
        raise ValueError(f"{path}: invalid contract {image.size} {image.mode}")
    minimum_alpha, maximum_alpha = image.getchannel("A").getextrema()
    if minimum_alpha != 0 or maximum_alpha == 0:
        raise ValueError(
            f"{path}: expected transparent background and nonempty artwork"
        )


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: clean-frame-edges.py SOURCE_DIR OUTPUT_DIR", file=sys.stderr)
        return 2

    source_dir = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    if source_dir == output_dir:
        raise ValueError("source and output directories must differ")
    if output_dir.exists():
        raise FileExistsError(f"refusing to reuse existing output: {output_dir}")

    names = expected_names()
    actual_names = sorted(path.name for path in source_dir.glob("frame_*.png"))
    if actual_names != names:
        raise ValueError(
            f"expected {names}, found {actual_names}"
        )

    output_dir.mkdir(parents=True)
    for name in names:
        source_path = source_dir / name
        output_path = output_dir / name
        with Image.open(source_path) as source:
            cleaned = clean_frame(source)
        validate_frame(cleaned, output_path)
        cleaned.save(output_path, format="PNG", optimize=True)
        with Image.open(output_path) as saved:
            validate_frame(saved, output_path)

    print(f"cleaned and validated {len(names)} frame assets into {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: Generate validated candidate assets outside the repository**

Run:

```bash
python3 /tmp/ginggingroom-clean-frame-edges.py assets/frames /tmp/ginggingroom-frame-edge-cleanup-20260720
```

Expected: `cleaned and validated 26 frame assets into /tmp/ginggingroom-frame-edge-cleanup-20260720`.

- [ ] **Step 4: Generate representative before/after comparisons**

Run the following command to create a checkerboard comparison for frames 1, 22, 25, and 26:

```bash
python3 -c 'from pathlib import Path; from PIL import Image,ImageDraw; ids=(1,22,25,26); tile=480; gap=24; sheet=Image.new("RGB",(tile*2+gap,tile*len(ids)),(230,230,230)); draw=ImageDraw.Draw(sheet); [draw.rectangle((x,y,x+39,y+39),fill=(55,55,55) if (x//40+y//40)%2 else (245,245,245)) for y in range(0,sheet.height,40) for x in range(0,sheet.width,40)]; [(sheet.paste(Image.open(Path(root)/f"frame_{index:02d}.png").convert("RGBA"),(column*(tile+gap),row*tile),Image.open(Path(root)/f"frame_{index:02d}.png").convert("RGBA"))) for row,index in enumerate(ids) for column,root in enumerate(("assets/frames","/tmp/ginggingroom-frame-edge-cleanup-20260720"))]; sheet.save("/tmp/ginggingroom-frame-edge-before-after.png")'
```

Inspect `/tmp/ginggingroom-frame-edge-before-after.png` at original resolution. The left column is the tracked source and the right column is the candidate. Expected:

- the right column has no pale detached rim on dark checker squares;
- soft fur and fabric contours remain continuous;
- thin features are not visibly clipped;
- the artwork does not gain a stroke, shadow, or color cast.

If any representative fails these checks, stop before copying assets and adjust only `ALPHA_FEATHER_RADIUS`, `INTERIOR_ALPHA`, or `COLOR_SEARCH_RADIUS`; keep the one-pixel `MinFilter(3)` contraction required by the design.

- [ ] **Step 5: Replace the tracked assets only after the visual gate passes**

Run:

```bash
cp /tmp/ginggingroom-frame-edge-cleanup-20260720/frame_*.png assets/frames/
```

Expected: all 26 tracked PNGs become modified; no additional repository path is created.

- [ ] **Step 6: Validate the replaced asset set**

Run:

```bash
python3 -c 'from pathlib import Path; from PIL import Image; paths=sorted(Path("assets/frames").glob("frame_*.png")); assert [p.name for p in paths]==[f"frame_{i:02d}.png" for i in range(1,27)]; [(lambda im,p: (None if im.size==(480,480) and im.mode=="RGBA" and im.getchannel("A").getextrema()[0]==0 and im.getchannel("A").getextrema()[1]>0 else (_ for _ in ()).throw(AssertionError(str(p)))))(Image.open(p),p) for p in paths]; print("validated 26 cleaned frames")'
git status --short
git diff --stat -- assets/frames
```

Expected: `validated 26 cleaned frames`, followed by exactly 26 modified frame PNGs in Git status/stat output.

- [ ] **Step 7: Commit only the cleaned frame assets**

Run:

```bash
git add assets/frames/frame_*.png
git diff --cached --stat
git commit -m "fix(frames): remove alpha fringe from assets"
```

Expected: one asset-only commit containing exactly the 26 PNG files.

### Task 3: Full Regression and Browser Visual Verification

**Files:**
- Verify: `js/frame-overlay.js`
- Verify: `tests/frame-overlay.test.mjs`
- Verify: `assets/frames/frame_01.png` through `assets/frames/frame_26.png`
- Verify: `js/app.js`
- Verify: `js/camera-renderer.js`

**Interfaces:**
- Consumes: cleaned tracked PNGs and the overscanned Canvas returned by `prepareFrameImage`.
- Produces: verified upload, live preview, capture, composition, and download behavior without further source changes.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
```

Expected: every `node:test` test passes with zero failures.

- [ ] **Step 2: Start the static development server**

Run:

```bash
npm run dev
```

Expected: the static server listens on `http://localhost:3000` and remains running for browser inspection.

- [ ] **Step 3: Inspect prepared frames on contrasting backgrounds in the browser**

Open `http://localhost:3000`, then evaluate this temporary browser-only preview:

```js
const [{ prepareFrameImage }, { FRAMES }] = await Promise.all([
  import('/js/frame-overlay.js'),
  import('/js/frame-config.js')
]);
const ids = ['frame-1', 'frame-22', 'frame-25', 'frame-26'];
const backgrounds = [
  ['light', '#f7f7f7'],
  ['dark', '#111111']
];
const preview = document.createElement('section');
preview.id = 'frame-edge-verification';
preview.style.cssText = [
  'position:fixed',
  'inset:0',
  'z-index:9999',
  'overflow:auto',
  'display:grid',
  'grid-template-columns:repeat(2, 480px)',
  'gap:16px',
  'padding:16px',
  'background:#888'
].join(';');
for (const id of ids) {
  const frame = FRAMES.find(candidate => candidate.id === id);
  const image = new Image();
  image.src = frame.src;
  await image.decode();
  const prepared = prepareFrameImage(image, frame);
  for (const [name, color] of backgrounds) {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(prepared, 0, 0);
    canvas.title = `${id} / ${name}`;
    preview.append(canvas);
  }
}
document.body.append(preview);
```

Expected:

- no white ring remains around generated face openings;
- no detached pale halo remains on either light or dark backgrounds;
- frame 25 retains both openings and its paired artwork;
- small frames retain their silhouette and texture;
- the browser console reports no exception.

- [ ] **Step 4: Exercise the normal app paths when the browser environment permits**

Remove the temporary preview with:

```js
document.getElementById('frame-edge-verification')?.remove();
```

Then:

- select representative frames in the frame rail;
- allow camera access and confirm live preview/capture if camera hardware is available;
- upload a local photo, confirm the selected frame aligns with detected faces, and download the composed PNG;
- inspect the downloaded PNG on both light and dark viewers.

Expected: upload, live preview, capture, and download behave as before, while both outer and face-opening boundaries look clean. If camera hardware or a suitable local photo is unavailable, report that exact check as unverified instead of claiming success.

- [ ] **Step 5: Perform the final scoped review**

Run:

```bash
git log -3 --oneline --decorate
git status --short
git diff --check
```

Expected:

- the two implementation commits appear above the design commit;
- only the implementation-plan document may remain uncommitted;
- no source, test, or asset change remains unstaged;
- `git diff --check` reports no whitespace error.
