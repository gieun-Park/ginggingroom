# Frame 25 Face Portrait Inset Design

## Context

Frame 25 is a paired character asset with two face openings. The paired renderer
correctly chooses the opening nearest the largest detected face and keeps both
characters inside the viewport. However, those two requirements force the
artwork scale below the face-fit scale.

For a representative 120-by-225-pixel face on a 600-by-750 canvas:

- the selected right opening needs a face-fit scale of `3.24`;
- keeping the full pair inside the configured viewport padding caps the scale at
  about `1.73`;
- the resulting opening is about 104-by-104 pixels.

The selected opening is centered correctly, but it shows only the nose area
because the detected face is much taller than the contained opening.

## Goals

- Keep both Frame 25 characters visible as one contained pair.
- Continue choosing the left or right opening from the detected face's
  horizontal position.
- Show the detected person's eyes, nose, and mouth naturally inside the selected
  opening.
- Keep live preview, camera capture, and uploaded-photo output consistent.
- Preserve the existing behavior of all other frames.
- Keep all image pixels and face data in the browser.

## Non-Goals

- Do not require the full forehead-to-chin face oval inside the opening.
- Do not enlarge Frame 25 beyond its existing contained bounds.
- Do not split the two characters into independently sized sprites.
- Do not place the detected face in both openings.
- Do not change the Frame 25 PNG or add a dependency, upload, remote processing,
  analytics, or telemetry.

## Configuration

Frame 25's paired layout will opt into a portrait inset:

```js
layout: {
  mode: 'paired',
  contentBounds: { left, top, right, bottom },
  viewportPadding: 0.04,
  portraitInset: {
    sourceWidthScale: 1.35
  }
}
```

`sourceWidthScale` defines a square source crop whose side is 1.35 times the
detected face width. This keeps the central facial features visible without
trying to fit the full, tall face oval into a nearly circular opening.
The value must be finite and greater than zero.

Normal frames and paired layouts without valid portrait metadata retain their
existing rendering behavior.

## Prepared Frame Metadata

The erased opening is affected by the prepared frame's mask scale:

- mobile camera Frame 25 uses `1.1`;
- desktop camera and uploaded photos use `1`.

`prepareFrameImage` will record the resolved mask scale on the returned canvas.
The portrait renderer will use that value when calculating the destination
ellipse, so the inserted portrait fills the actual erased opening rather than
leaving a background ring or covering frame artwork.
If the recorded value is missing or invalid, the portrait calculation uses the
existing default mask scale of `1`.

The prepared frame remains a drawable canvas and keeps its existing width and
height interface.

## Portrait Source Crop

The renderer will snapshot the face crop before drawing any frame artwork.

1. Use the same first placement already selected for the paired frame.
2. Calculate a square crop with side
   `placement.width * portraitInset.sourceWidthScale`.
3. Center the crop on `placement.centerX` and `placement.centerY`.
4. Limit the side to the source canvas's shorter dimension.
5. Move the crop rectangle inward when it crosses an edge so it remains square
   and inside the canvas.
6. Copy that source rectangle into a temporary browser canvas.

Live camera pixels are already mirrored before this step, and live placements
are mapped into the same mirrored canvas coordinate system. Uploaded photos and
their placements are both unmirrored. The crop therefore needs no separate
mirroring branch.

## Destination Opening

The existing paired transform continues to select the nearest anchor and
calculate the contained pair scale.

The destination portrait ellipse is centered at the detected face placement,
which is also the transformed center of the selected anchor. Its radii are
derived from:

```text
selected anchor size
× prepared frame dimensions
× contained pair scale
× prepared mask scale
```

The temporary portrait is drawn into that clipped ellipse first. The prepared
Frame 25 canvas is then drawn on top using the existing paired transform. This
ordering lets the frame artwork cover the crop boundary and keeps the inset
visually attached to the selected character.

Only one portrait is drawn. The unselected opening remains transparent and
shows the original background beneath it.

## Rendering Flow

Frame 25 rendering will follow this order:

1. Validate paired layout metadata and canvas dimensions.
2. Select the largest visible placement and the nearest left or right anchor.
3. Calculate the existing face-fit and viewport-contain scales.
4. Use the smaller scale to keep the full pair visible.
5. Snapshot the central face portrait from the source canvas.
6. Draw the portrait into the selected erased opening.
7. Draw one upright Frame 25 pair on top.
8. Ignore additional placements, as the current paired design does.

Both `drawLiveComposition` and uploaded-photo rendering already draw source
pixels before calling `drawFrameOverlays`. Camera capture also uses the same live
composition path. No separate capture-only behavior is required.

## Failure Behavior

Portrait insertion is an enhancement to a valid paired draw, not a prerequisite
for showing the frame.

If the portrait metadata, crop geometry, source canvas, temporary canvas, or
temporary 2D context is unavailable, the renderer will skip only the portrait
insertion and draw the current contained Frame 25 pair. It will not interrupt
camera composition or fall back to duplicate per-face pairs.

Invalid paired layout metadata continues to use the existing generic per-face
fallback. No visible face placement continues to produce no overlay.

## Test Coverage

Focused tests will verify:

- Frame 25 opts into a portrait inset with source width scale `1.35`;
- normal frames do not opt into portrait insertion;
- prepared frames expose their resolved mask scale;
- the source crop is square, centered on the face, and bounded by the canvas;
- the left opening receives the portrait for a face in the left half;
- the right opening receives the portrait for a face in the right half;
- the portrait destination matches the selected anchor, pair scale, and prepared
  mask scale;
- the portrait draw happens before the Frame 25 artwork draw;
- exactly one portrait and one pair are drawn for multiple placements;
- the unselected opening receives no copied portrait;
- portrait snapshot failure still draws the contained pair;
- invalid paired metadata retains the existing per-face fallback;
- normal single-face frame rendering remains unchanged.

The complete `npm test` suite and static build command will run after
implementation. Browser verification at a mobile viewport will compare Frame 25
live preview and captured output with a real camera when available, confirm that
eyes, nose, and mouth appear in the selected opening, and confirm that both
characters remain visible without horizontal page overflow.

## Privacy

The temporary portrait canvas is created and consumed during local Canvas 2D
composition. It is not stored after the draw, transmitted, uploaded, logged, or
used for analytics. Existing browser-only handling of photos, landmarks, masks,
and composed canvases remains unchanged.
