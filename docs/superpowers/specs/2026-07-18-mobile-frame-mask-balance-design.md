# Mobile Frame Mask Balance Design

## Context

Mobile camera sessions currently render costume frames at 80% of their original fitted size so users do not need to hold the phone as far away. The frame bitmap is prepared with a 125% face-mask scale, which compensates exactly for the 80% overlay scale:

```text
0.8 overlay scale × 1.25 mask scale = 1.0 effective opening size
```

This keeps the transparent face opening at its former on-screen size while shrinking the surrounding artwork. In practice, too much of the costume frame is erased around the face.

## Decision

Use a 110% mobile camera mask scale while keeping the existing 80% frame overlay scale:

```text
0.8 overlay scale × 1.10 mask scale = 0.88 effective opening size
```

The opening's width and height will therefore be about 12% smaller than the current mobile treatment. This preserves more frame artwork without returning to the tighter 100% proportional mask option.

## Behavior

- Mobile live camera preview keeps `overlayScale: 0.8`.
- Mobile live camera preview changes from `maskScale: 1.25` to `maskScale: 1.1`.
- Mobile camera captures use the same 80% overlay and 110% mask values as the live preview.
- Desktop camera composition remains `overlayScale: 1` and `maskScale: 1`.
- Uploaded photos remain `overlayScale: 1` and `maskScale: 1`, including on narrow viewports.
- Camera zoom options and timer behavior do not change.
- Existing per-frame mask anchors remain unchanged.

## Implementation Boundary

The rendering profile in `js/app.js` is the source of the mobile mask value. The frame preparation and cache-key mechanisms already accept arbitrary mask scales, so no rendering API or frame configuration changes are needed.

Tests will verify that:

- mobile live preview prepares and renders the selected frame with `maskScale: 1.1` and `overlayScale: 0.8`;
- the captured result retains `overlayScale: 0.8`;
- desktop and uploaded-photo profiles remain unchanged;
- prepared-frame caching distinguishes the mobile 1.1 variant from the default 1.0 variant.

## Verification

- Run the focused app tests through a red-green TDD cycle.
- Run the full `npm test` suite.
- Run `npm run dev` and confirm on a mobile-sized camera view, when camera hardware is available, that the live preview and captured result preserve more frame artwork around the face.
- Report hardware-camera behavior as unverified if the available browser cannot expose a real camera stream.
