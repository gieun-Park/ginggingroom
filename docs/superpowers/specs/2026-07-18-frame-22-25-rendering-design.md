# Frame 22 and 25 Rendering Corrections Design

## Context

Two frame assets need behavior that differs from the default single-face costume rendering:

- Frame 22 loses part of its hood because its face-fit anchor is also used as the erase mask, and the mobile 110% mask compensation expands that already-tall box.
- Frame 25 contains two character costumes in one PNG. The current renderer fits the entire bitmap to the first 43-by-40-pixel face anchor and draws one copy for every detected face. At a representative 120-by-225-pixel face placement, the mobile scale becomes `4.86`, the bitmap spans roughly `-524` through `1809` on a 600-pixel-wide canvas, and the second slot center lands near `x = 1031`.

The desired behavior is:

- preserve Frame 22's original hood artwork;
- always show both Frame 25 characters for one detected person;
- align that person to the nearer left or right character slot based on the face's horizontal screen position.

## Frame 22 Calibration

Frame 22 will retain its current face-fit anchor, `[210, 178, 263, 242]`, so its artwork size and placement do not change.

Its erase mask will be separated from the fit anchor and calibrated to the original white opening measured from the source asset:

```text
[213, 193, 263, 242]
```

Frame 22 will also declare a mobile mask-scale override of `1`. Other mobile frames continue to use the shared `1.1` mask scale. Desktop camera and uploaded-photo rendering continue to use scale `1`.

## Frame Configuration

Frame definitions will support optional rendering metadata without changing the existing defaults:

```js
{
  mobileMaskScale: 1,
  layout: {
    mode: 'paired',
    contentBounds: { left, top, right, bottom },
    viewportPadding: 0.04
  }
}
```

- `mobileMaskScale` is absent for normal frames and falls back to the mobile profile's `1.1`.
- `layout.mode` defaults to the existing per-face behavior.
- `contentBounds` is normalized against the 480-by-480 source image.
- `viewportPadding` is a fraction of the canvas's shorter side.

Frame 22 uses only `mobileMaskScale: 1`.

Frame 25 uses paired layout metadata with the measured non-transparent source bounds:

```text
[88, 152, 393, 328]
```

Its existing two mask anchors remain unchanged.

## Mobile Mask Selection

The app will resolve the prepared-frame mask scale from both the active rendering profile and selected frame:

```text
mobile camera + frame override -> frame.mobileMaskScale
mobile camera + no override    -> 1.1
desktop camera or upload       -> 1
```

The resolved number remains part of the prepared-frame cache key. Frame 22's mobile variant can therefore reuse the same `1` preparation as desktop and uploads without mixing incompatible masks.

## Paired Frame 25 Placement

The paired renderer uses the existing sorted placements and draws exactly one Frame 25 bitmap.

1. Use the first placement, which is already the largest visible detected face.
2. If its center is in the left half of the canvas, choose the left mask anchor. Otherwise choose the right mask anchor.
3. Calculate the normal face-fit scale using the chosen anchor's width and height.
4. Calculate the maximum scale that can align the chosen anchor to the detected face while keeping Frame 25's measured content bounds inside the viewport padding on all four sides.
5. Draw with the smaller of the face-fit scale and the contain scale.
6. Keep the paired artwork upright with zero rotation.
7. Draw no duplicate pair for additional detected faces.

If there is no visible face placement, the existing no-overlay behavior remains. If paired metadata or canvas dimensions are invalid, the renderer falls back to the existing per-face path instead of interrupting camera composition.

All normal frames continue through the current loop that draws one costume per visible detected face, including face rotation.

## Rendering Flow

Both live camera preview and captured camera output already use `drawFrameOverlays`, so paired placement and Frame 22 calibration will match between preview and capture.

Uploaded photos also use the same overlay drawer. Frame 25 therefore keeps its paired behavior for uploads, while Frame 22 uses the default mask scale `1`. No photo pixels, landmarks, masks, or canvases leave the browser.

## Testing

Focused tests will cover:

- Frame 22 keeps its existing fit anchor but uses the corrected erase mask and mobile scale override;
- all other frame definitions retain the existing defaults;
- the app resolves Frame 22's mobile mask scale to `1` while normal mobile frames remain `1.1`;
- paired rendering chooses the left slot for a face on the left and the right slot for a face on the right;
- paired rendering draws once for multiple placements;
- paired content bounds remain within the configured viewport padding;
- paired rendering uses zero rotation;
- malformed paired metadata falls back to existing per-face drawing;
- existing single-face frame drawing remains unchanged.

The complete `npm test` suite and static build command will run after implementation. Browser verification will confirm mobile layout stability and, when camera hardware is available, compare live preview with captured output. Hardware-dependent behavior will be reported as unverified if the test browser cannot expose a real camera stream.
