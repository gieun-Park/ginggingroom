# Frames 27–37 and Multi-Face Slot Design

## Goal

Add frames 27 through 37 to the photo booth while preserving each source asset's aspect ratio and making every intended face opening genuinely transparent. Multi-opening frames must place separate detected faces into separate openings, while a single detected face uses only the representative opening and leaves every unused opening transparent so the original photo remains visible.

Frame 33 is a special portrait layout: its full 1080×1920 composition must remain visible, and the white center screen must become a transparent face window without removing the surrounding pink border or overlapping decorations.

## Confirmed Behavior

- Register frames 27 through 37 in their numeric order.
- Preserve the native dimensions and aspect ratio of every new frame.
- Continue using the existing face-following overlay behavior for the single-opening costume frames: 27, 30, 31, 32, 34, 35, 36, and 37.
- Treat frames 28 and 29 as anchored multi-slot layouts.
  - Frame 28 uses the middle opening as its representative slot. The remaining slot order is top, then bottom.
  - Frame 29 uses the large upper-center opening as its representative slot. The remaining slot order is lower-left, then lower-right.
  - One detected face fills only the representative slot.
  - Two or three detected faces fill the same number of slots, up to the frame's three-slot capacity.
  - Additional faces beyond the slot capacity are not copied into the frame.
  - The largest visible detected face is assigned to the representative slot. Remaining faces are assigned from left to right to the remaining configured slots.
  - An unfilled slot stays transparent and reveals the original camera or uploaded-photo background.
- Treat frame 33 as a contained portrait-slot layout.
  - Center the full portrait frame on the output canvas using `contain` sizing; never crop its top or bottom to fill the canvas.
  - Use the largest visible detected face for its single center-screen slot.
  - Crop enough surrounding source pixels to fill the screen aspect ratio without stretching the face.
- Use the same rendering rules for live camera preview, uploaded-photo preview, capture, and PNG download.

## Asset Preparation

Asset preparation is deterministic and must not redraw, regenerate, or stylistically alter the supplied artwork.

- Frames 27 through 32 already contain alpha and retain their original files.
- Convert frame 33 from JPEG to an RGBA PNG at 1080×1920.
  - Remove only the connected white screen region inside the pink screen border.
  - Preserve border pixels, overlapping decorations, and the entire portrait composition.
  - Apply a small edge cleanup at the alpha boundary so no white fringe remains.
- Frames 34 through 37 contain a baked gray-and-white checkerboard rather than real transparency.
  - Convert the exterior checkerboard and each enclosed face-opening checkerboard to alpha.
  - Use edge-connected neutral-region removal plus enclosed-opening masks so colored costume highlights are not removed.
  - Clean the matte edge without changing the colored artwork or native resolution.
- Keep all processing local to the repository and all runtime photo data inside the browser.

The initial face-opening boxes, measured in each source asset's native pixels, are:

| Frame | Native size | Slot or opening boxes |
| --- | --- | --- |
| 27 | 480×480 | `[138,176,337,402]` |
| 28 | 480×480 | middle `[193,119,285,211]`; top `[193,23,281,105]`; bottom `[197,216,286,307]` |
| 29 | 480×480 | upper `[159,148,294,245]`; lower-left `[105,300,199,366]`; lower-right `[270,316,355,391]` |
| 30 | 480×480 | `[85,180,315,343]` |
| 31 | 480×480 | rectangular opening `[62,165,418,414]` |
| 32 | 480×480 | `[117,134,352,314]` |
| 33 | 1080×1920 | center screen, bounded approximately by `[198,660,893,1110]`; final alpha follows the connected white region inside the border |
| 34 | 216×350 | `[58,173,157,248]` |
| 35 | 204×340 | `[37,165,159,242]` |
| 36 | 236×296 | `[69,105,170,193]` |
| 37 | 217×340 | `[46,150,156,229]` |

These measurements are calibration inputs. Visual browser verification may tighten a box inward or outward by a few pixels to preserve artwork and eliminate fringe, but must not change which opening is used or the approved slot order.

## Configuration Model

Generalize frame-coordinate normalization so boxes are divided by the frame's actual native width and height instead of assuming 480×480.

Keep the existing default overlay configuration for ordinary single-opening frames. Add an optional slot layout with two positioning strategies:

- `anchored`: the frame is positioned and scaled from the representative face and representative slot. It remains upright so secondary portraits do not rotate as a group. Used by frames 28 and 29.
- `contain`: the entire frame is centered and contained within the output canvas. Used by frame 33.

Each slot records:

- its normalized center, width, and height;
- its clip shape (`ellipse` or `rect`);
- its order, with the first slot representing the approved primary slot.

Mask preparation and portrait-slot clipping share the same normalized geometry so the visible alpha opening and the face destination cannot drift apart.

## Rendering Architecture

The existing source renderer continues to draw the full camera frame or uploaded photo first. The overlay renderer then branches by layout mode.

### Standard single-opening overlays

Use the current behavior unchanged: draw one prepared costume overlay for each visible detected face, aligned to that face's position, size, and rotation.

### Anchored multi-slot overlays

For frames 28 and 29:

1. Stop if no valid face placement exists, preserving the current no-face fallback.
2. Snapshot the already-rendered base canvas before adding portraits or frame artwork.
3. Assign the largest visible face to the representative slot.
4. Compute one upright frame transform from that face and the representative slot.
5. Build a transparent frame-local portrait layer.
6. For every assigned face, crop from the base snapshot with aspect-ratio-preserving cover sizing and draw it into its slot under the slot clip.
7. Leave unassigned slots untouched and transparent.
8. Draw the prepared frame artwork once above the portrait layer using the same transform.

This avoids repeating the entire frame per face and guarantees that separate people occupy separate openings.

### Contained portrait-slot overlay

For frame 33:

1. Compute a centered `contain` transform from the 1080×1920 frame to the output canvas.
2. Snapshot the base canvas.
3. If a valid face exists, crop the largest visible face from the snapshot and cover-fit it into the center screen without stretching.
4. If no face exists, leave the center screen transparent so the underlying source remains visible.
5. Draw the full prepared portrait frame once above the screen content.

The transform must use the full frame bounds, not the face slot bounds, so the top and bottom of the portrait artwork always remain visible.

## Validation and Fallbacks

- Invalid or incomplete slot configuration must not throw during preview or capture. It falls back to the existing standard overlay path when a valid face anchor exists; otherwise it skips that overlay.
- A missing or unloaded asset follows the existing preload fallback and does not block camera or upload use.
- A failed or empty face-detection result keeps the original source usable and never prevents capture or download.
- Crops use only the already-rendered in-browser canvas. No image, face coordinates, segmentation data, or output canvas is uploaded or logged.

## Testing

Add focused `node:test` coverage for:

- all 37 frame IDs, labels, source paths, and valid normalized coordinates;
- non-480 native-size normalization for frames 33 through 37;
- frame 28 and 29 primary-slot order and three-slot capacity;
- one-face multi-slot rendering drawing the frame once and leaving secondary slots unpainted;
- two- and three-face assignment, deterministic representative selection, and capacity limiting;
- frame 33 centered `contain` math on portrait, square, and landscape output canvases;
- rectangular center-screen clipping without face stretching;
- malformed slot-layout fallback;
- preservation of existing standard and paired frame behavior.

Run the full `npm test` suite. Then run `npm run dev` and verify frames 27 through 37 with both uploaded images and the live camera when permission is available. Specifically verify one-, two-, and three-face examples for frames 28 and 29, full-height visibility for frame 33, true transparency for frames 33 through 37, preview/capture parity, and PNG download output.

## Non-Goals

- Do not add face segmentation, remote image processing, analytics, telemetry, dependencies, or build tooling.
- Do not redesign frames 1 through 26 or alter their current calibration.
- Do not invent extra slots for frames that contain only one intended face opening.
- Do not fill unused multi-face slots by duplicating the same person.

## Acceptance Criteria

- Frames 27 through 37 appear in the selector and render without breaking frames 1 through 26.
- New frame artwork has clean transparent backgrounds and face openings with no checkerboard or white fringe.
- Frames 28 and 29 show one person only in the approved representative opening and show separate people in separate openings when multiple faces are detected.
- Frame 33 preserves its complete portrait composition and shows the selected face inside the transparent center screen.
- Live preview, uploaded-photo preview, capture, and download agree visually.
- All automated tests pass, and browser checks confirm the calibrated openings and aspect-ratio behavior.
