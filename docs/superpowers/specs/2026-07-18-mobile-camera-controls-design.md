# Mobile Camera Controls Design

**Date:** 2026-07-18
**Status:** Approved direction, pending written-spec review

## Context

On mobile devices, the current costume frames occupy too much of the camera view. Users have to move the phone far away to fit the full frame around themselves. The camera also has a fixed five-second timer and no way to use a wider hardware camera view when the browser exposes one.

This change will make the live mobile camera easier to use while preserving the existing camera-first flow:

- render costume frames at 80% of their current size on mobile camera sessions;
- keep the face opening aligned and approximately the same visible size after the frame shrinks;
- expose 0.5x, 0.8x, and 1x camera zoom choices only when the active camera track actually supports them;
- let the user cycle the timer through off, 3 seconds, 5 seconds, and 7 seconds;
- keep the live preview and captured output visually consistent.

## Scope and Decisions

The feature applies to camera captures at the existing mobile breakpoint, `max-width: 480px`.

- Mobile live preview and mobile camera capture use the 80% frame treatment.
- Desktop camera sessions and uploaded photos keep the current frame scale and masks.
- The selected mobile frame scale is fixed for this version. There is no freeform frame-size slider.
- Hardware zoom is progressive enhancement. Unsupported choices are not shown, and no simulated zoom-out is used.
- Timer selection is a single cycling button: `끔 → 3초 → 5초 → 7초 → 끔`.
- Existing frame images and model binaries are not modified.
- All image processing and camera capability checks remain in the browser.

## User Experience

### Camera entry

The page continues to open directly into the live camera. The frame carousel remains above the shutter button, and the selected frame remains visible in real time.

On screens up to 480px wide, the selected costume frame appears at 80% of its current rendered size. The face opening stays centered over the detected face and retains approximately the same visible opening size as today, so the smaller costume does not crop the user's face.

### Zoom control

When the active video track reports usable zoom capabilities, a compact pill control appears at the bottom center of the camera stage. It contains only the supported values among:

- `0.5x`
- `0.8x`
- `1x`

The group is hidden unless at least two candidate values can be applied. This avoids showing a one-option control and avoids promising ultra-wide behavior that the device or browser cannot provide.

Selecting a value applies it to the current video track and updates the pressed state only after the constraint succeeds. The selected value is retained for a retake when the new stream supports it. Otherwise, the camera uses its current/default setting.

No software crop, letterboxing, blurred margins, camera enumeration, or lens guessing is used as a fallback.

### Timer control

The timer remains a single button near the shutter. Each tap advances:

1. `끔`
2. `3초`
3. `5초`
4. `7초`
5. back to `끔`

The chosen delay is used for the next capture and is preserved across retakes during the page session. While a countdown is active, frame, zoom, timer, and capture controls are locked. Capture occurs exactly once when the countdown completes.

### Review and upload modes

Zoom controls are visible only during a live camera session. They are hidden in captured-photo review and upload flows.

Uploaded photos retain the current rendering behavior at full frame scale, even on a narrow screen. The 80% treatment is tied to mobile camera composition rather than viewport size alone.

## Rendering Architecture

### Frame preparation variants

`prepareFrameImage` will accept an optional mask scale, defaulting to `1`. Prepared-frame caching will distinguish the frame ID and mask scale so that desktop/upload and mobile-camera variants cannot be mixed.

For the mobile camera variant:

- overlay scale: `0.8`;
- mask scale: `1 / 0.8`, or `1.25`;
- mask centers remain unchanged.

Each mask ellipse's width and height are multiplied by `1.25` while the prepared bitmap dimensions remain unchanged.

### Frame drawing

`drawFrameOverlays` will accept an optional overlay scale, defaulting to `1`. Its existing face-fit scale is multiplied by the supplied overlay scale before the frame bitmap is drawn.

The compensation is intentional:

```text
visible face opening = existing opening × mask scale × overlay scale
                     = existing opening × 1.25 × 0.8
                     = existing opening
```

This shrinks the costume artwork around the face without proportionally shrinking the face opening. Translation, rotation, mirroring, and multi-face placement continue to use the existing landmark-derived placement.

The live renderer and captured-photo composition receive the same camera-session rendering profile. This is the contract that keeps the saved photo consistent with the preview.

### Responsive profile

The app creates a camera rendering profile when the camera session starts:

```js
{
  overlayScale: isMobileCamera ? 0.8 : 1,
  maskScale: isMobileCamera ? 1.25 : 1
}
```

`isMobileCamera` is determined using the existing CSS breakpoint equivalent, `matchMedia('(max-width: 480px)')`. A resize or orientation change may update the profile before the next render, but a capture uses one profile consistently from its final preview frame through composition.

## Camera Zoom Architecture

A small camera-controls module will isolate capability detection and constraint application from app UI state.

### Capability filtering

After the video is playing and has an active video track:

1. Read `track.getCapabilities?.().zoom`.
2. Read `track.getSettings?.().zoom` for the current value.
3. Filter `[0.5, 0.8, 1]` against the reported minimum, maximum, and step.
4. Expose the zoom group only when at least two values are applicable.

If the browser does not implement the capability APIs, omits zoom capability, or reports no applicable candidates, the control remains hidden.

Step validation allows only values the reported range can represent, using a small floating-point tolerance. Values are not relabeled or silently substituted.

### Applying zoom

Selection uses the active track's constraint API with the chosen numeric zoom value. UI selection changes only after the promise resolves.

If application fails:

- the live camera remains active;
- the requested choice is not marked selected;
- the zoom group is hidden for the rest of that stream;
- a concise, non-blocking camera status explains that zoom is unavailable;
- the app does not switch to upload fallback or restart the camera solely because zoom failed.

Starting a new stream clears the old track reference and recomputes capabilities. Stopped or replaced tracks cannot receive later constraint calls.

## State and Lifecycle

The app owns:

- `timerSeconds`, one of `0`, `3`, `5`, or `7`;
- `preferredZoom`, one of the supported numeric candidates or `null`;
- supported zoom options for the current stream;
- the current camera rendering profile;
- whether capture controls are locked.

Timer and preferred zoom survive a retake in memory. They reset on page reload.

When a camera stream ends or is replaced, listeners and control state associated with its track are cleared. Late asynchronous zoom results are ignored when they belong to an inactive stream.

## Accessibility and Layout

- The zoom group has the accessible label `카메라 배율`.
- Each zoom button exposes `aria-pressed`; only the successfully applied value is pressed.
- The timer button displays `끔`, `3초`, `5초`, or `7초`.
- The timer button's accessible label includes the current value, such as `타이머: 3초`.
- Timer pressed state is false only when the timer is off.
- Disabled state is exposed on all locked controls during countdown.
- Touch targets remain at least 44px in both dimensions.
- The zoom pill respects the camera stage safe area and does not overlap the shutter, frame carousel, countdown, or camera status.
- Camera status occupies its own safe slot when the zoom control is visible.
- At 320px, 375px, and 480px widths, controls remain reachable without horizontal overflow.

## Privacy and Performance

Camera tracks, frames, masks, landmarks, and composed images remain local to the browser. This change adds no uploads, remote processing, analytics, telemetry, dependencies, or services.

Prepared frame variants are cached and reused by frame ID and mask scale. Capability detection runs once per active stream rather than on every render frame.

## Error Handling

- Missing camera zoom capability: hide zoom controls and continue normally.
- Failed zoom constraint: preserve the live stream, report a non-blocking status, and hide zoom for that stream.
- Camera permission or stream failure: retain the existing upload fallback behavior.
- Frame/model processing failure: retain the existing safe fallback behavior.
- Unsupported `matchMedia`: default to the existing full-size rendering profile.

## Test Strategy

Focused automated tests will cover:

- zoom candidate filtering for missing capabilities, range boundaries, step alignment, and floating-point tolerance;
- successful and failed zoom constraint application;
- stale-stream zoom results;
- mobile mask expansion and the 80% overlay scale;
- default scale compatibility for desktop and uploads;
- live-preview and captured-output use of the same rendering profile;
- timer cycling in the exact off/3/5/7 order;
- countdown start values, control locking, cancellation behavior, and exactly-once capture;
- zoom visibility, pressed state, failure state, and retake preference handling;
- responsive control layout and accessible labels/states.

Verification will include:

- `npm test`;
- `npm run build`;
- `git diff --check`;
- `npm run dev` browser checks at 320px, 375px, and 480px widths;
- live preview versus captured output comparison;
- validation across all 26 frame assets for face-opening clipping;
- a physical-device check when compatible camera hardware and browser capability are available.

Hardware zoom support cannot be guaranteed by desktop emulation. Any device-specific behavior not observed on physical hardware will be reported explicitly.

## Acceptance Criteria

- Mobile camera frames render at 80% of their previous costume size.
- The displayed face opening remains approximately the previous size and stays aligned.
- The mobile captured result matches the live preview treatment.
- Desktop camera and uploaded-photo composition remain unchanged.
- Only actually supported zoom candidates are shown.
- Zoom failure does not stop the camera or discard the current session.
- Timer cycles through off, 3, 5, and 7 seconds and captures once after the selected delay.
- Controls remain accessible and usable at supported mobile widths.
- Existing camera permission, upload, composition, PNG download, and ML fallback behavior is preserved.

## Non-goals

- A frame-size slider or per-frame user calibration.
- Per-frame custom mobile scaling.
- Simulated 0.5x or 0.8x using canvas effects.
- Automatic switching between physical camera devices.
- Editing frame PNG files or model binaries.
- Changing uploaded-photo or desktop frame sizing.
