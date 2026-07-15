# Camera-First Live Frames Design

Date: 2026-07-16
Status: Approved for implementation planning

## Summary

Gingging Room will open as a camera-first experience instead of an upload-first two-column photo booth. After camera permission is granted, the main 4:5 preview will immediately show the mirrored front camera with the selected character frame aligned to each detected face in real time.

The frame choices will appear in a horizontal rail directly above the shutter button. An optional five-second timer will show a visible countdown before capture. After capture, the app will stop the live camera and show the composed still with download and retake actions.

Automatic person segmentation and solid-white background replacement will be removed. Camera captures and uploaded fallback photos will preserve their photographed backgrounds in both preview and downloaded output.

## Confirmed product decisions

- Request the front-facing camera when the page initializes.
- Use an inline camera experience rather than a separate modal.
- Display the selected character frame over detected faces in the live camera preview.
- Place a horizontally scrollable frame selector immediately above the shutter controls.
- Provide a timer control that toggles between off and five seconds.
- Show a centered `5` through `1` countdown and prevent duplicate captures while it runs.
- After capture, replace the live view with a still preview and show download and retake actions.
- Retake returns to the camera while preserving the selected frame and timer preference.
- Preserve the original photographed background; do not run background segmentation or white composition.
- Keep photo upload as the fallback when camera access is unavailable or denied.

## Goals

1. Make the camera the first and dominant interface shown on page entry.
2. Keep live frame tracking responsive enough to feel attached to faces on mobile and desktop.
3. Make frame selection reachable near the shutter without covering the face preview.
4. Provide a predictable five-second hands-free capture flow.
5. Keep captured and downloaded images visually consistent, including the original background.
6. Stop camera and animation resources whenever the live camera is not active.

## Non-goals

- Video recording, boomerangs, stories, or social posting.
- User-configurable timer durations other than off and five seconds.
- Background blur, replacement, removal, or color selection.
- Beauty filters, color grading, stickers, gestures, or audio cues.
- Server-side image processing or photo uploads.
- Persisting the selected frame or timer across page reloads.

## User flow

### Successful camera flow

1. The page renders the camera shell and requests the front-facing camera.
2. After permission is granted, the mirrored camera appears in the main 4:5 preview.
3. The live face tracker updates placements at a controlled rate while the canvas render loop draws every available video frame and the most recent placements.
4. The user scrolls the frame rail and selects a frame. The selection updates the live overlay without restarting the camera or face tracker.
5. With the timer off, tapping the shutter captures immediately. With the timer on, tapping the shutter starts a centered five-second countdown and captures at zero.
6. Capture freezes the mirrored camera image and selected overlays into the output canvas, stops the media tracks, and enters review mode.
7. Download exports the same canvas shown in review mode.
8. Retake restarts the camera and live tracking while retaining the selected frame and timer preference.

### Camera fallback flow

1. If camera APIs are unavailable or camera permission fails, the camera shell presents a concise error and a photo-upload action.
2. An uploaded image becomes the review image with its original background.
3. Existing still-image face detection aligns the selected frame, and download remains available after detection settles.

## Architecture

### Camera state boundary

Add a focused camera session boundary rather than leaving media, animation, countdown, and capture lifecycle inside DOM construction code. It owns these states:

- `idle`: camera has not started or was stopped.
- `starting`: permission or media startup is pending.
- `live`: video frames and live tracking are active.
- `countdown`: capture is locked while the remaining seconds are published.
- `review`: a captured or uploaded still is displayed.
- `error`: camera startup failed and the upload fallback is available.

The session must ignore stale startup results after retake/reset transitions, cancel outstanding animation frames and timer handles, and stop every media track exactly once when leaving a live state.

### Live face detection

Extend the MediaPipe face-detection boundary with a dedicated video-mode detector using the existing pinned runtime and local face-landmarker model. Configure it with `runningMode: 'VIDEO'`, the existing confidence thresholds, and the existing ten-face limit. Use `detectForVideo(video, timestamp)` and convert landmarks through the same `landmarksToPlacement` geometry used for still images.

Detection is throttled independently from drawing. The preview render loop uses `requestAnimationFrame`, but starts a new face detection only when the configured detection interval has elapsed and no previous detection is still running. The renderer continues using the newest valid placements between detections. This keeps motion smooth without running model inference on every display refresh.

The existing image-mode detector remains available for uploaded fallback photos and for a final still analysis when needed. A live detector failure must not hide the camera: the app continues showing the unframed camera, displays an overlay status, and offers retry without restarting the media stream.

### Preview and capture rendering

Use the existing 600×750 canvas as the only visible camera and review surface. Each live render:

1. Clears the canvas.
2. Draws the mirrored camera using the existing cover transform so the 4:5 canvas is filled without distortion.
3. Maps normalized face placements through the same mirrored cover geometry.
4. Draws the prepared selected frame over every visible placement.

Capture copies the current mirrored camera frame at output resolution, applies the selected overlays from the latest valid placements, and keeps that composition on the canvas while entering review mode. The downloaded PNG is generated from this same canvas.

No background segmentation state participates in readiness or rendering. There is no white fill behind extracted people, background status, retry action, or segmentation loading gate.

### UI components

- **Camera shell:** the 4:5 canvas, startup/error status, and upload fallback.
- **Frame rail:** a single-row horizontal scroller of square frame thumbnails with a clear selected state.
- **Capture controls:** a timer toggle, large circular shutter, and compact upload fallback action.
- **Countdown overlay:** large centered remaining seconds, announced through a polite live region.
- **Review controls:** download and retake buttons shown only in review mode.

The previous desktop two-column frame panel and camera modal are removed. The primary layout stays centered and narrow enough to resemble a mobile camera on desktop, while using the available viewport width on phones.

## Timer behavior

- The timer defaults to off on initial page load.
- Tapping the timer control toggles between `끔` and `5초` and exposes the selected state accessibly.
- When off, tapping the shutter captures immediately.
- When enabled, tapping the shutter starts at five and updates once per second through one before capture.
- The shutter, timer control, frame selection, and upload action are disabled during countdown.
- A second shutter activation cannot create another timer or capture.
- Leaving the live state cancels pending timer handles so a stale countdown cannot capture after reset, error, or review.

## Frame selection behavior

- Frame thumbnails are preloaded as they are today.
- Selecting a loaded frame updates the live overlay on the next render frame.
- Selecting a frame still loading preserves the selection and redraws when the asset becomes available.
- Selection never restarts the camera, live detector, or still detector.
- Retake preserves selection; a full page reload returns to the default unselected state.
- If no frame is selected, camera capture and download still work with the original scene.

## Original-background behavior

Remove automatic background processing from the application flow:

- Do not initialize or call the SelfieSegmenter.
- Do not create a person foreground or replace pixels outside its mask.
- Do not block download on background-analysis state.
- Remove background status and retry UI.
- Remove background-specific runtime documentation and obsolete automated tests from the active feature suite.
- Ensure uploaded and captured source pixels are drawn directly before frame overlays.

The original photo or camera background is therefore retained exactly as covered and mirrored by the preview transform.

## Error and accessibility behavior

- Camera permission or API failure shows a Korean error message and a visible upload fallback.
- A live face-detector failure keeps the camera usable without a frame and provides a retry control.
- The shutter and timer are native buttons with accessible names and visible focus states.
- The selected frame exposes pressed/selected state, and the frame rail supports keyboard navigation through its buttons.
- Countdown changes are visible and announced without repeating unrelated camera status.
- `prefers-reduced-motion` disables nonessential entrance and hover animations but does not change camera or countdown timing.

## Resource lifecycle and privacy

- Start only one active media stream and one live render loop.
- Stop all media tracks when entering review, on page teardown, and before replacing a stale stream.
- Cancel animation frames and timeout handles whenever their owning state ends.
- Never run overlapping live detector calls.
- Photos, camera frames, landmarks, composed canvases, and downloads remain in browser memory.
- No server endpoint, analytics call, or form submission receives image data.

## Testing strategy

### Unit and integration tests

- Camera initialization requests `{ video: { facingMode: 'user' } }` during app initialization.
- Camera session publishes startup, live, countdown, review, error, and retake transitions.
- Stale media startup results cannot replace a newer session and stale timers cannot capture.
- Leaving live mode stops media tracks, cancels animation frames, and clears countdown handles.
- Video face detection initializes in `VIDEO` mode, calls `detectForVideo` with monotonic timestamps, and prevents overlapping inference.
- The live renderer draws mirrored source pixels before selected overlays and reuses the latest placements between detections.
- Frame selection updates the live overlay without restarting media or detection services.
- Timer off captures once immediately; timer on publishes `5` through `1` and captures once.
- Controls stay locked during countdown and unlock appropriately after cancellation or retake.
- Capture transitions to review, download uses the review canvas, and retake returns to live mode with frame and timer settings preserved.
- Camera failure exposes upload fallback; uploaded photos keep their original background and can receive frames.
- No app path imports, initializes, calls, or waits for background segmentation.
- HTML and CSS contracts lock the inline 4:5 camera, horizontal frame rail, shutter placement, review controls, responsive sizing, and accessible status regions.

### Browser acceptance

Verify on desktop and a mobile viewport:

- The page requests the front camera and shows it inline without requiring a camera-button click.
- Camera content fills the 4:5 preview and uses the expected mirrored selfie orientation.
- A selected frame follows head position and rotation with acceptable visual latency.
- Frame scrolling and selection remain usable without covering the shutter or overflowing the viewport.
- Timer mode visibly counts down from five and produces exactly one capture.
- The captured review matches the final live composition closely and keeps the real background.
- Downloaded PNG pixels match the review canvas.
- Retake releases the old stream and creates one new live stream without duplicated loops.
- Permission denial and unsupported-camera cases expose a working upload fallback.
- Live detector failure leaves the camera and capture path usable.
- No segmentation model request or white-background status appears in network or UI behavior.

## Acceptance criteria

The feature is complete when:

1. Opening the page automatically starts an inline front-camera experience when permission is granted.
2. The selected frame is aligned to detected faces in the live camera view.
3. The frame rail is directly above the shutter and is usable by touch, mouse, and keyboard.
4. The optional five-second timer counts down visibly and captures only once.
5. Capture enters review mode with download and retake actions, and retake restores the live camera.
6. Camera and uploaded images retain their original backgrounds in preview and download.
7. Camera, animation, timer, and detector resources are cleaned up across all transitions.
8. Automated tests pass and browser acceptance confirms the camera, timer, frame, fallback, and original-background flows.
