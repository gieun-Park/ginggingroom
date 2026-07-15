# Large Frame Preview and Automatic White Background Design

Date: 2026-07-15
Status: Approved for implementation planning

## Summary

Gingging Room will make the left photo canvas the primary, larger result preview. Clicking any frame card will immediately redraw the selected frame over every detected face in that preview without repeating face detection or background segmentation.

Every uploaded photo and captured camera still will also be processed in the browser to separate people from the photographed environment. The canvas and downloaded PNG will use a fixed white background behind the retained people and the selected frame overlays.

## Confirmed product decisions

- The large preview stays in the left photo section rather than opening a modal or adding a second result canvas.
- Frame selection updates the large preview immediately.
- White-background removal is automatic for both uploads and captured camera stills; there is no on/off toggle.
- Every person retained by the segmentation model remains visible, including multi-person photos.
- The same selected frame continues to be applied to every detected face, up to ten faces.
- Face detection and person segmentation each run once per accepted photo. Frame changes reuse both cached results.
- Photos, face landmarks, and segmentation masks remain inside the browser.

## Goals

1. Make the composed photo large enough to be the obvious primary preview at desktop and mobile widths.
2. Keep the preview visible while a user compares frames on desktop.
3. Replace the photographed environment with solid white while retaining people, hair, clothing, and accessories as naturally as the model allows.
4. Keep preview and downloaded PNG output identical.
5. Preserve current upload, camera, multi-face alignment, retry, reset, and stale-request protections.

## Non-goals

- Live background removal while the camera preview is open.
- Manual mask editing, brush tools, background color selection, blur, or background image replacement.
- Server-side image processing or photo upload.
- Guaranteeing perfect segmentation for distant, heavily occluded, motion-blurred, or very small people.
- Changing the existing maximum of ten frame-aligned faces.

## User flow

1. The user uploads a photo or captures a camera still.
2. The large preview enters a processing state while face detection and person segmentation run for that still image.
3. The preview renders a white background, the retained people, and the currently selected frame over every detected face.
4. Clicking another frame card immediately redraws only the overlay layer using cached face placements and the cached transparent foreground.
5. Download exports the same white-background composition shown in the preview.
6. Reset invalidates pending work and clears the photo, foreground, masks, selected frame, statuses, and action controls.

If the user selects a frame before loading a photo, the selection remains active and the empty preview continues to show its photo prompt. The selected frame is applied once the photo finishes processing.

## Technical approach

### Segmentation model and runtime

Use the MediaPipe Tasks Vision `ImageSegmenter` from the same pinned `@mediapipe/tasks-vision` 0.10.35 runtime already used by face detection.

Bundle the official float16 square SelfieSegmenter model locally as:

```text
assets/models/selfie_segmenter.tflite
```

The implementation source is the official versioned model path:

```text
https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite
```

Configure the task for still images:

```js
{
  baseOptions: { modelAssetPath: SELFIE_SEGMENTER_MODEL_URL },
  runningMode: 'IMAGE',
  outputCategoryMask: false,
  outputConfidenceMasks: true
}
```

The square SelfieSegmenter provides background at index 0 and person at index 1. Copy `confidenceMasks[1]` and use it as a soft alpha mask so hair and clothing edges are not reduced to a hard binary cutout. Close every MediaPipe mask after the copied float data is owned by the application.

### New boundaries

Add these modules rather than embedding segmentation details directly in `app.js`:

- `js/background-segmentation.js`
  - Lazily initializes and reuses `ImageSegmenter`.
  - Returns a copied, browser-owned person confidence mask so MediaPipe result resources can be closed immediately.
  - Clears a failed initialization only when it is still the active initialization, matching the face detector's race-safe cache behavior.
  - Exposes `reset()` for retrying model initialization.
- `js/background-composite.js`
  - Converts a confidence mask and the original photo into an offscreen transparent foreground canvas.
  - Uses soft alpha and scales the mask to the source photo dimensions.
  - Draws white, the foreground, and later frame overlays through explicit helpers that can be unit tested.
- `js/background-session.js`
  - Owns per-photo states: `idle`, `loading`, `ready`, and `error`.
  - Uses a request generation so older success or failure results cannot replace a newer photo or resurrect state after reset.
  - Retains the original photo for retry and caches the prepared foreground when ready.

The existing `photo-session.js` remains responsible for face detection. The app starts the face and background sessions for the same accepted still and renders whenever either state changes.

### Rendering order

`renderCanvas()` uses one cover transform for the original photo coordinate space and canvas. The render order is:

1. Clear and fill the entire output canvas with `#ffffff`.
2. If background segmentation is ready, draw the cached transparent foreground using the photo's existing cover transform.
3. While segmentation is loading, keep the preview white and show the processing status instead of briefly exposing the original environment.
4. If segmentation failed, draw the original photo as a usable fallback and show a background-removal error with retry.
5. If face detection and a selected frame are ready, draw one prepared overlay for every visible mapped face.

The app always runs face detection against the original decoded photo, not the cutout, so segmentation quality cannot reduce face detection accuracy.

### Resource lifetime

- Copy the person mask data before closing MediaPipe mask/result resources.
- Cache one prepared foreground canvas per current photo only.
- Revoke or discard the old foreground and mask when a new photo is accepted or reset occurs.
- Reuse the initialized segmenter across photos unless model initialization fails and the user retries.

## Large preview layout

### Desktop

- Give the photo column more space than the frame column using `minmax(0, 7fr) minmax(320px, 5fr)`, an exact 58.3/41.7 split before the second column's minimum applies.
- Increase the output canvas from 400×500 to 600×750 logical pixels for a sharper large preview and PNG.
- Let the preview canvas fill the available photo card width while preserving its 4:5 aspect ratio.
- Keep the photo section sticky below the top edge while the user scrolls the frame grid, provided the viewport is wider than the existing single-column breakpoint.
- Keep the frame grid independently scrollable with non-overlapping cards.

### Mobile and narrow windows

- Retain the existing single-column booth layout.
- Disable sticky positioning.
- Place the large preview before the frame grid and scale it to the viewport width without horizontal overflow.
- Keep two frame columns at and below the 480px breakpoint; cards must shrink within their columns without horizontal overflow or overlap.

### Frame interaction

- Frame cards remain visibly selected with the existing active border/check state.
- A click updates the large canvas immediately when the frame image is already prepared.
- If the clicked frame image is still loading, preserve the selection and redraw as soon as its preload callback fires.
- Frame selection never restarts face detection or person segmentation.

## Status and error behavior

The existing face status remains independent. Add a background status with `role="status"` and `aria-live="polite"`.

Required Korean messages:

- Loading: `배경을 흰색으로 정리하는 중…`
- Ready: `흰색 배경을 적용했어요.`
- Error: `배경을 지우지 못했어요. 원본 사진으로 표시합니다.`
- Retry button: `배경 다시 시도`

Retry resets only the segmenter initialization and reruns segmentation for the retained photo. It must not rerun face detection. A stale background retry result cannot replace a newer photo.

If face detection fails but background removal succeeds, the white-background person preview remains visible and the existing face retry remains available. If background removal fails but face detection succeeds, the original photo fallback can still receive aligned frames.

## Privacy and security

- Original photos, camera stills, landmarks, masks, foreground canvases, and downloads remain in browser memory.
- The runtime JavaScript continues to load from the pinned jsDelivr version already used by the app.
- Both MediaPipe model binaries are served from local `assets/models/` paths.
- No fetch, form submission, analytics, logging, or server endpoint may receive photo or mask data.

## Testing strategy

### Unit tests

- Segmenter initializes once with the pinned runtime, local model, `IMAGE` mode, and confidence-mask options.
- Failed initialization can retry, and an old rejection cannot clear a newer initialization.
- Mask resources are copied and closed.
- Soft alpha produces transparent background and retained foreground pixels.
- Background session publishes exact loading/ready/error/idle states.
- Background session suppresses stale success/failure and reset races.
- Background retry reuses the retained photo without invoking face detection.
- Render order is white fill, foreground or fallback photo, then frame overlays.
- Frame changes reuse cached foreground and face results.
- Reset clears background state and prepared foreground.
- HTML/CSS contracts lock the 600×750 preview, desktop emphasis/sticky behavior, and mobile sticky reset.
- The local segmentation model has a pinned size and SHA-256 integrity assertion.

### Browser acceptance

Verify with the local static server at desktop and mobile viewports:

- The current merged module graph loads without cached legacy-script errors.
- The large preview is visually dominant and has no horizontal overflow.
- Clicking several frame cards changes the same large preview immediately.
- Detector and segmenter call counts remain one per photo during frame changes.
- A single-person example has a white environment with hair/clothes retained.
- A multi-person example retains all visible people and applies the same frame to each detected face.
- Loading never flashes the original environment before the white result.
- Forced segmentation failure shows the original fallback and working retry.
- Face-only failure and background-only failure remain independently recoverable.
- Downloaded PNG pixels match the white-background preview composition.
- Reset and camera/photo replacement suppress stale segmentation results.

## Acceptance criteria

The feature is complete when:

1. The left preview is larger, responsive, and sticky on desktop.
2. Every accepted still automatically attempts white-background person segmentation.
3. The preview and PNG both use solid white behind retained people when segmentation succeeds.
4. Frame selection redraws the large result immediately without new face or background analysis.
5. Multi-person photos retain all people recognized by the model and continue to receive one matching frame per detected face, up to ten.
6. Error and retry behavior preserves a usable photo and never allows stale work to replace newer state.
7. All processing remains browser-only, automated tests pass, and browser acceptance records any model-quality limitations honestly.

## Official references

- MediaPipe Image Segmenter web guide: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js
- MediaPipe Image Segmenter overview and models: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter
- MediaPipe Selfie Segmentation model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf
