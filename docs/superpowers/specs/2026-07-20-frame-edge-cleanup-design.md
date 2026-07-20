# Frame Edge Cleanup Design

## Context

The 26 frame PNGs contain pale matte colors in some partially transparent
boundary pixels. Those pixels appear as a white fringe when a frame is composed
over a photo. The face openings have a second boundary source: most openings
are erased at runtime by `prepareFrameImage`, so cleaning only the stored PNGs
would leave some white placeholder pixels around the generated ellipse.

The change must improve both boundaries without adding a visible outline,
shadow, or new visual style. Frame dimensions, placement, scaling, camera
behavior, uploaded-photo composition, and PNG download behavior must remain
unchanged.

## Decision

Use a hybrid cleanup:

1. Clean the existing alpha boundaries in every frame PNG.
2. Slightly overscan runtime face masks so the generated openings remove the
   remaining placeholder edge.

This separates the two causes of the fringe. Stored image artifacts are fixed
once in the assets, while runtime-only openings continue to respect the current
mask anchors and mobile mask scaling.

## Stored PNG Cleanup

Process all files in `assets/frames/` as 480×480 RGBA images.

- Contract the alpha channel by one source pixel, then apply a 0.5-pixel
  Gaussian feather. This removes the outermost fringe without introducing a
  hard cut.
- For pixels left partially transparent by that alpha operation, replace their
  RGB with the nearest source pixel within two pixels whose alpha is at least
  224. If no such pixel exists, retain the source RGB. This removes pale matte
  contamination while keeping the artwork's local color.
- Keep each image's filename, dimensions, color mode, and transparent
  background.
- Do not add strokes, shadows, sharpening, or recoloring.

The cleanup operation will first produce temporary outputs and validate their
dimensions and alpha channel before replacing tracked assets. The original
files remain recoverable from Git history; duplicate production assets are not
added.

## Runtime Face-Mask Cleanup

Update `prepareFrameImage` so each configured face-mask ellipse extends 1.5
source pixels beyond its current horizontal and vertical radii. The overscan is
added after applying `maskScale`, which keeps the correction visually
consistent across default and mobile rendering profiles.

- Define the 1.5-pixel allowance as an internal frame-preparation constant.
- Preserve Canvas antialiasing at the ellipse boundary; do not draw an outline.
- Keep face anchors and per-frame mask anchors unchanged.
- Preserve the existing behavior for multiple openings and paired frame
  layouts.

The cleanup value belongs to frame preparation rather than placement. It is not
a call-site option, so existing prepared-frame cache keys do not change.

## Data Flow

1. The browser loads a cleaned frame PNG.
2. `prepareFrameImage` draws it to the existing offscreen canvas.
3. Runtime mask ellipses erase face placeholders with the small overscan.
4. Existing overlay placement draws the prepared frame over the local camera
   or uploaded photo.
5. Existing composition and download paths reuse the same prepared frame.

All image data stays in the browser. The asset cleanup is a local repository
operation and introduces no upload, remote processing, analytics, or telemetry.

## Failure and Compatibility Behavior

- If runtime mask metadata is valid, edge cleanup is applied uniformly.
- Existing Canvas drawing remains the fallback; no browser-only filter API or
  external runtime dependency is introduced.
- The cleanup must not erase facial photo content beyond the narrow fringe
  allowance or materially change the perceived opening size.

## Testing and Verification

Add focused frame-overlay tests that verify:

- the cleanup allowance expands each ellipse radius by exactly 1.5 source
  pixels;
- mask scaling and cleanup allowance compose independently;
- multiple openings receive the same cleanup;
- drawing and placement behavior remain unchanged.

Then:

- run the full `npm test` suite;
- validate all 26 processed assets for 480×480 RGBA dimensions and nonempty
  alpha;
- compare representative frames on both light and dark backgrounds, including
  a large single frame, a small frame, and paired frame 25;
- run `npm run dev` and inspect live/upload composition and the downloaded PNG
  when browser access permits.

Any camera-hardware check that cannot be performed will be reported explicitly.
