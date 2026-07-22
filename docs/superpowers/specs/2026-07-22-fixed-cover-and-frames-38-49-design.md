# Fixed Cover Frames and Frames 38–49 Design

## Goal

Change frames 31 and 33 from face-following layouts into fixed, full-canvas photo-frame overlays. Add frames 38 through 49 as ordinary single-face costume overlays after converting their baked checkerboard backgrounds and face openings to clean transparency.

All photo pixels, detected face geometry, prepared frame canvases, and composed output remain in the browser. The change adds no uploads, remote processing, analytics, telemetry, dependencies, services, or build tooling.

## Confirmed Behavior

### Frames 31 and 33

- Draw each selected frame once, centered on the output canvas.
- Preserve the source aspect ratio and use `cover` sizing: the frame fills the complete canvas, and only artwork outside the canvas bounds is cropped.
- Ignore detected face position, size, count, and rotation when positioning the frame.
- Ignore the existing mobile costume scale so the fixed frame always covers the viewport.
- Draw the frame even when no face is detected.
- Preserve the existing transparent opening so the already-rendered camera or uploaded photo remains visible beneath the artwork.
- Use identical sizing for live preview, uploaded-photo preview, capture, and PNG download.

### Frames 38 Through 49

- Register all twelve frames in numeric order after frame 37.
- Preserve each asset's native dimensions and aspect ratio.
- Use the existing standard single-face behavior: prepare one transparent costume image, then position, rotate, and scale a copy over every valid detected face.
- Use one calibrated face anchor and one matching erase mask per frame.
- Continue to show the original photo without an overlay when no face is detected.
- Do not introduce multi-face slot layouts for these single-opening costumes.

The supplied native dimensions are:

| Frame | Native size |
| --- | --- |
| 38 | 225×270 |
| 39 | 206×274 |
| 40 | 263×279 |
| 41 | 256×278 |
| 42 | 242×276 |
| 43 | 249×287 |
| 44 | 250×337 |
| 45 | 223×316 |
| 46 | 238×275 |
| 47 | 273×275 |
| 48 | 293×282 |
| 49 | 242×270 |

## Asset Preparation

Frames 38 through 49 are supplied as opaque PNG files with a gray-and-white checkerboard baked into both the exterior and the single enclosed face opening.

Asset cleanup must be deterministic and limited to transparency:

1. Identify neutral checkerboard pixels connected to the image edges and clear them to alpha zero.
2. Identify the single neutral checkerboard component enclosed by the costume's face opening and clear it to alpha zero.
3. Expand cleanup only across the adjacent one-to-two-pixel neutral gray or white fringe at those two boundaries.
4. Preserve colored costume pixels, pale highlights, character details, decorations, dimensions, and all other visible source artwork.
5. Save the cleaned results over the corresponding `frame_38.png` through `frame_49.png` paths as RGBA PNGs.

The face anchor for each frame is the normalized bounding box of its cleaned enclosed opening, measured against that frame's native width and height. Calibration may move the box inward from the transparent boundary only when browser verification shows fringe or costume overlap; it must remain centered on the same single opening.

## Configuration Model

Add a `cover` layout mode to the existing optional `layout` metadata.

- Frames 31 and 33 use `layout: { mode: 'cover' }`.
- Frame 33 no longer uses its current `contain` portrait-slot layout or copies a face crop into the center window.
- Frames 38 through 49 omit `layout`, keeping them on the standard single-face path.
- Coordinate normalization continues to accept each asset's native source size, preserving the existing default for older 480×480 frames.
- Frame IDs, labels, and source paths remain numeric and sequential from 1 through 49.

## Rendering Architecture

The source renderer first draws the camera frame or uploaded photo to the output canvas, as it does today. The overlay renderer then branches by layout mode.

For `cover` layouts:

1. Validate the output-canvas and prepared-frame dimensions.
2. Compute `scale = max(canvasWidth / frameWidth, canvasHeight / frameHeight)`.
3. Translate to the center of the output canvas.
4. Apply the uniform scale.
5. Draw the prepared frame once around its own center.
6. Return without consulting face placements, face rotation, or `overlayScale`.

If the `cover` metadata or dimensions are invalid, the renderer must skip that overlay without throwing; it must not fall through to face-following behavior. All existing `paired`, `anchored`, `contain`, and standard face-following branches remain unchanged for other frames.

Frames 38 through 49 follow the unchanged standard branch. Their native-size face anchors determine frame placement around each detected face, while the prepared alpha assets prevent checkerboard pixels from covering the photo.

## Validation and Fallbacks

- Missing or unloaded assets continue to use the existing frame preload fallback and must not block camera or upload use.
- Empty or failed face detection still permits preview, capture, and download. Fixed `cover` frames remain visible; standard frames remain absent until a face placement exists.
- Invalid frame geometry must not throw or corrupt the base photo.
- Asset processing is local to the repository and must not access user photos.
- Existing frames 1 through 30, 32, and 34 through 37 retain their current rendering modes and calibration.

## Testing

Add focused `node:test` coverage for:

- all 49 frame IDs, labels, source paths, and numeric ordering;
- native-size coordinate normalization for frames 38 through 49;
- `cover` metadata on frames 31 and 33 and removal of frame 33's `contain` slot metadata;
- centered `cover` scale and draw coordinates for square and portrait frame assets on portrait, square, and landscape canvases;
- fixed frames drawing exactly once with zero, one, or multiple face placements and never rotating;
- invalid `cover` dimensions failing safely;
- frames 38 through 49 remaining on the standard face-following path;
- RGBA output, transparent exterior samples, transparent face-opening samples, and retained opaque artwork samples for every cleaned asset;
- preservation of existing standard, paired, anchored, and contain behavior for unaffected frames.

Run the full `npm test` suite. Then run `npm run dev` and verify frames 31, 33, and 38 through 49 with both uploaded images and the live camera when permission is available. Confirm selector order, clean edges, face alignment, fixed-frame behavior, preview/capture parity, and downloaded PNG output.

## Non-Goals

- Do not redraw, regenerate, recolor, or stylistically alter the supplied artwork.
- Do not remove or modify visible artwork outside the checkerboard and its neutral boundary fringe.
- Do not add segmentation, remote background removal, or new runtime image-processing dependencies.
- Do not change frame assets 1 through 37.
- Do not recalibrate unaffected frame definitions.

## Acceptance Criteria

- Frames 31 and 33 fill the canvas as centered, aspect-ratio-preserving fixed overlays and do not follow faces.
- Frames 31 and 33 render once even with no detected face and match across preview, capture, and download.
- Frames 38 through 49 appear in numeric selector order and follow every valid detected face using the existing standard behavior.
- The exterior and face opening of each new asset are genuinely transparent, with no visible checkerboard or neutral edge fringe.
- Colored costume artwork and pale character details remain intact at native resolution.
- Frames 1 through 30, 32, and 34 through 37 retain their existing behavior.
- Automated tests pass, and browser checks confirm clean edges, calibrated alignment, and output parity.
