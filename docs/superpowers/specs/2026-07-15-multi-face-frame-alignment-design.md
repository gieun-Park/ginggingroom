# Multi-Face Frame Alignment Design

- Date: 2026-07-15
- Status: Approved

## Summary

After a user uploads a photo or captures one with the camera, the app detects up to ten faces in the image. The frame selected in the existing frame picker is then duplicated and aligned to every detected face using the face center, dimensions, and eye-line rotation. Detection runs locally in the browser and is reused when the selected frame changes.

## Goals

- Detect up to ten faces in an uploaded or captured still image.
- Apply the same selected frame to every detected face.
- Align each frame to the detected face's center, size, and rotation.
- Preserve the frame artwork's aspect ratio instead of warping the character.
- Re-render immediately when the selected frame changes without running detection again.
- Keep photos and face landmark data in the browser.
- Preserve the existing upload, camera, frame selection, reset, and download flows.

## Non-Goals

- Live face tracking in the camera preview.
- Different frame selections for different people.
- Manual per-face positioning controls.
- Processing more than ten detected faces.
- Exact mesh warping of the frame artwork to the user's face contour.
- Uploading photos or landmark data to a server.

## Existing Context

The current app draws a photo into a 400 by 500 canvas using a `cover` transform, then draws one 480 by 480 frame image across the entire canvas. The 26 frame assets have face placeholders at different locations and sizes, but the frame definitions do not currently describe them. Some placeholders are already transparent while others are opaque white circles, so the renderer must normalize every selected frame to a transparent face opening before compositing it.

The feature therefore needs both face landmarks for the photo and a calibrated face-opening anchor for every frame asset.

## Selected Approach

Use MediaPipe Face Landmarker in `IMAGE` mode. Configure `numFaces` to 10 and request only the landmark output needed for placement. Blendshapes and facial transformation matrices are not required.

MediaPipe Face Landmarker supports still-image detection, multiple configured faces, normalized landmarks, and face-effect placement. The implementation will pin `@mediapipe/tasks-vision` 0.10.35 instead of using a floating `latest` URL. The JavaScript and WASM runtime will load from versioned jsDelivr URLs, while the model file will be stored with the app assets so inference does not depend on a remote model URL.

Official reference: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js

## Architecture

### Face detection adapter

`js/face-detection.js` owns MediaPipe initialization and exposes one app-facing operation:

```text
detectFaces(image) -> Promise<FacePlacement[]>
```

Each `FacePlacement` contains image-normalized values:

```text
centerX, centerY, width, height, rotation
```

The adapter derives the bounds from face-oval landmarks and the rotation from the eye line. It lazy-loads the model on the first photo and reuses the initialized detector afterward.

The configured maximum is ten faces. If MediaPipe returns ten results, the UI explains that only up to ten faces can be processed. The API does not expose enough information to guarantee which faces would be omitted when a photo contains more than ten people, so the product must not claim that the ten highest-confidence faces are selected.

### Frame anchor metadata

Every frame configuration gains a normalized `faceAnchor` and one or more `maskAnchors`:

```text
centerX, centerY, width, height
```

`faceAnchor` describes the opening used to align the frame to a detected face. `maskAnchors` describe regions that must be punched to transparency before compositing, including opaque white placeholders. Values are calibrated for all 26 existing assets and kept with the corresponding frame definition so replacing an asset requires reviewing only that frame's metadata. Frame 25 contains two placeholders; its left opening is the alignment anchor and both openings are normalized to transparency.

### Geometry and overlay engine

`js/frame-overlay.js` owns pure geometry and canvas drawing operations:

- Prepare a masked copy of the selected frame in an offscreen canvas by erasing every configured face-opening ellipse.
- Map normalized face placement from the original image through the canvas `cover` transform.
- Ignore detections whose centers fall outside the visible canvas crop.
- Compute a uniform frame scale large enough for the detected face bounds to fit within the configured face opening.
- Translate the frame anchor center onto the face center.
- Rotate the frame around the face center using the eye-line angle.
- Draw larger face overlays first and smaller overlays afterward to reduce the chance that foreground artwork hides small, distant faces.

Uniform scaling preserves the character artwork. The face opening metadata supplies the per-frame differences needed for a natural fit without distorting the frame independently on the X and Y axes.

### App orchestration

The app state gains:

```text
facePlacements, detectionStatus, detectionError, photoRequestId
```

The upload and camera flows both call the same still-image analysis path. `photoRequestId` prevents a slow result for an older photo from replacing a newer selection. Selecting a frame only calls `renderCanvas()` with cached placements.

The existing browser scripts will be divided into testable modules where needed, while keeping the visible page behavior and static hosting model unchanged.

## Data Flow

1. The user uploads or captures a photo.
2. The app stores the decoded image and renders the unframed photo immediately.
3. The UI shows `얼굴 분석 중…` and initializes MediaPipe if necessary.
4. MediaPipe returns up to ten landmark collections.
5. The adapter converts each landmark collection into a `FacePlacement`.
6. The app stores the placements and changes the status to ready.
7. If a frame is selected, the renderer maps placements through the photo's `cover` transform and draws one copy of that frame per visible face.
8. Selecting another frame reuses the stored placements and renders synchronously.
9. Download exports the canvas exactly as displayed.

## User Interface States

- Idle: existing prompt to upload or capture a photo.
- Loading model or detecting: `얼굴 분석 중…`; frame selection remains available.
- Ready: `얼굴을 N명 찾았어요` and the selected frame is applied to all N faces.
- Ten results: `얼굴은 최대 10명까지 적용할 수 있어요.`
- No face: keep the photo visible and show `얼굴을 찾지 못했어요. 정면 사진으로 다시 시도해주세요.`
- Detector failure: keep the photo visible and show `얼굴 인식을 불러오지 못했어요.` with a retry action.
- Frame loading: retain the analysis result and render automatically when the selected frame image finishes loading.

While detection is pending or failed, the app does not fall back to stretching one frame across the full canvas.

## Error Handling

- Detector initialization is cached, but a rejected initialization can be retried.
- Stale results are discarded using `photoRequestId`.
- Invalid or incomplete landmarks are skipped without failing other faces.
- Faces outside the visible photo crop are skipped.
- An unavailable frame image produces the existing frame-load warning and leaves the photo visible.
- Camera permission and capture errors keep their existing messages and never start face detection without a decoded image.

## Privacy and Runtime Constraints

- Face detection runs entirely in the browser.
- Photos and landmarks are not sent to an application server.
- The MediaPipe runtime may be loaded from a pinned package location, but the image is never supplied to that location.
- The face model is stored in the deployed app assets.
- Detection runs once per still image, not continuously, to keep mobile CPU and battery usage bounded.

## Testing Strategy

### Unit tests

- Convert image-normalized landmarks into face placement values.
- Map placements through portrait and landscape `cover` transforms.
- Align a frame anchor center with the detected face center.
- Preserve frame aspect ratio while fitting the face bounds.
- Punch transparent openings for frames whose source assets contain opaque white face placeholders.
- Apply eye-line rotation around the face center.
- Sort large overlays before small overlays.
- Filter faces outside the visible crop.
- Cap the processed result set at ten.

### App integration tests

- One, three, and ten detector results produce the same number of frame draws.
- Every detected face receives the selected frame.
- Changing frames does not call the detector again.
- Upload and captured-image paths invoke the same analyzer.
- A stale detection result cannot replace a newer photo.
- No-face, model-failure, retry, and delayed-frame-load states display the expected UI and keep the photo visible.

### Browser verification

- Verify upload, frame selection, frame switching, reset, and download on desktop and mobile viewport sizes.
- Verify representative single-person and group photos.
- Confirm the canvas result matches the downloaded PNG.
- Confirm there are no console errors or missing model, WASM, or frame assets.

## Acceptance Criteria

- A still image with one to ten detectable, visible faces receives one copy of the selected frame per face.
- Each frame opening is centered on its face, scaled to contain the face bounds, and rotated with the eye line.
- Opaque face placeholders in source assets do not cover the user's face in the composed result.
- Selecting a new frame updates all faces without re-running detection.
- The app clearly communicates loading, no-face, ten-face-limit, and detector-error states.
- Existing photo upload, camera capture, reset, frame selection, and download behavior remains functional.
- No photo or landmark data is transmitted to an application server.
