# Frame 25 Single-Face Fit Design

## Context

Frame 25 currently keeps both characters inside the camera viewport and copies a
smaller crop of the detected face into the nearest opening. The original camera
source remains visible behind the artwork, so this produces two visible versions
of the same face: the original full-size face and the copied miniature face.

Other frames do not copy camera pixels. They scale the artwork so its opening
fits the detected face and let the original source show through that opening.
Frame 25 should use the same single-source pattern.

## Decision

Frame 25 will stop copying a portrait. It will select the character opening
nearest the largest detected face and scale the paired artwork from that opening
using the existing face-fit calculation.

The original camera or uploaded-photo pixels will be the only face pixels in the
composition. The selected opening will surround the original face, so the face
appears once and includes the same forehead-to-chin area as normal frames.

Face fit takes priority over keeping the complete pair inside the canvas.
Depending on the person's position and distance, the unselected character can be
partially cropped or fully outside the canvas. This trade-off was explicitly
accepted in favor of a natural single face.

## Alternatives Considered

### 1. Fit the nearest character to the original face

This is the selected approach. It matches the working pattern used by normal
frames, removes duplicated camera pixels, and requires no image reconstruction.
The unselected character is not guaranteed to remain visible.

### 2. Keep the contained pair and copy a smaller portrait

This keeps both characters visible, but it is the current rejected behavior. A
miniature face appears over the original face and looks artificial.

### 3. Split the asset into one large character and one small decoration

This could retain both characters, but it introduces independent sprite
cropping, placement, and empty-opening behavior that does not exist in the
source asset. It is more complex and would no longer behave like the other
frames.

## Configuration

Frame 25 will replace its portrait insertion metadata with an explicit paired
scale mode:

```js
layout: {
  mode: 'paired',
  contentBounds: { left, top, right, bottom },
  viewportPadding: 0.04,
  scaleMode: 'face'
}
```

`scaleMode: 'face'` means the selected opening uses the face-fit scale without
being reduced by the viewport-contain scale.

Paired layouts without this value retain the existing contained-pair behavior,
so the change remains opt-in and does not alter future or malformed paired
layouts accidentally.

The `portraitInset` configuration will be removed.

## Rendering Flow

Frame 25 rendering will follow this order:

1. The camera or uploaded photo is drawn once using the existing source-cover
   path.
2. Visible face placements are mapped into the same canvas coordinates and
   sorted by size.
3. The paired renderer uses the first, largest placement.
4. The left opening is selected for a face in the left canvas half; the right
   opening is selected for a face in the right half.
5. The normal face-fit scale is calculated from the placement dimensions, the
   selected anchor dimensions, frame padding, and mobile overlay scale.
6. Because Frame 25 uses `scaleMode: 'face'`, that face-fit scale is used
   directly instead of the smaller contained-pair scale.
7. One prepared Frame 25 image is drawn, upright, with the selected opening
   centered on the original face.

No temporary portrait canvas, clipped portrait ellipse, or second draw of face
pixels remains.

Additional detected placements remain ignored for this paired asset, matching
the current nearest-slot behavior and preventing duplicate pairs.

## Cleanup

The portrait-only implementation will be removed:

- `portraitInset` metadata;
- browser portrait canvas creation;
- bounded portrait snapshotting;
- clipped portrait insertion;
- the optional portrait canvas factory argument on `drawFrameOverlays`;
- prepared-canvas mask-scale metadata that was consumed only by portrait
  insertion.

Invalid mask scales can continue to normalize to `1` while preparing erased
openings. That safety behavior is independent of portrait insertion.

The earlier portrait-inset design and plan documents remain as historical
records and are superseded by this design.

## Failure Behavior

Invalid paired layout or anchor metadata continues to use the existing generic
per-face fallback.

No detected face continues to produce no frame overlay.

If the face-fit scale is invalid, the paired path falls back through the same
existing validation behavior. Camera composition, upload fallback, capture, and
download remain available.

## Test Coverage

Focused tests will verify:

- Frame 25 opts into `scaleMode: 'face'` and no longer has
  `portraitInset`;
- a representative face uses the full face-fit scale even when it exceeds the
  viewport-contain scale;
- the nearest left or right anchor remains selected;
- exactly one prepared frame image is drawn for multiple placements;
- no temporary portrait canvas or clipped portrait draw occurs;
- paired layouts without face scale mode retain contained behavior;
- invalid paired metadata retains the generic per-face fallback;
- normal frame rendering remains unchanged;
- invalid mask scale normalization still erases finite openings.

The complete `npm test` suite and static build command will run after
implementation.

Mobile browser verification at 390 by 844 will confirm:

- only one version of the person's face is visible;
- the selected character opening surrounds the full original face;
- the frame switches to the nearest left or right opening;
- live preview and captured output match;
- retake restores the same behavior;
- the page has no horizontal overflow.

## Privacy

The fix removes the temporary copied portrait entirely. Camera pixels, uploaded
photos, landmarks, and composed canvases remain in the browser, with no new
storage, upload, remote processing, analytics, or telemetry.
