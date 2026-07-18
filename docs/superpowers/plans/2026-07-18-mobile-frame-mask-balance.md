# Mobile Frame Mask Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve more costume-frame artwork around the face on mobile by changing only the camera mask compensation from 125% to 110%.

**Architecture:** Keep the existing rendering pipeline and public function signatures unchanged. Update the mobile-only rendering profile in `js/app.js`; existing prepared-frame caching will automatically create a distinct `1.1` variant and both live preview and camera capture will consume that profile.

**Tech Stack:** Browser JavaScript ES modules, Canvas 2D composition, Node.js `node:test`

## Global Constraints

- Mobile camera composition keeps `overlayScale: 0.8`.
- Mobile camera composition uses `maskScale: 1.1`.
- Desktop camera composition and uploaded photos remain `overlayScale: 1` and `maskScale: 1`.
- Live preview and camera capture must use the same mobile profile.
- Camera zoom options, timer behavior, frame anchors, and frame assets do not change.
- Do not add dependencies, uploads, remote processing, analytics, or telemetry.
- Run `npm test` after the JavaScript and test changes.

---

## File Structure

- Modify `tests/app.test.mjs` to express the selected mobile mask behavior and cache variant in regression tests.
- Modify `js/app.js` to change the mobile rendering profile's mask scale.
- No other production, frame-configuration, asset, or styling files change.

### Task 1: Balance the mobile camera mask

**Files:**
- Modify: `tests/app.test.mjs:595`
- Modify: `tests/app.test.mjs:634`
- Modify: `js/app.js:18`

**Interfaces:**
- Consumes: `createApp(...)`, the existing `(max-width: 480px)` media-query profile selection, injected `framePreparer`, and injected `liveCompositionDrawer`.
- Produces: mobile camera rendering profile `{ overlayScale: 0.8, maskScale: 1.1 }` with no public API changes.

- [ ] **Step 1: Update the mobile profile regression tests**

Rename the mobile profile test and change its mobile mask expectations to `1.1`:

```js
test('uses the balanced 80 percent frame profile only for mobile camera composition', async () => {
  const harness = makeAppHarness({
    liveFaces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }],
    windowRef: {
      matchMedia: query => ({ matches: query === '(max-width: 480px)' })
    }
  });
  harness.app.init();
  await harness.flushCamera();
  harness.elements.frameGrid.children[0].listeners.click();
  await harness.runAnimationFrame(100);

  assert.equal(harness.liveDraws.at(-1).overlayScale, 0.8);
  assert.equal(harness.liveDraws.at(-1).preparedFrame.maskScale, 1.1);
  assert.equal(harness.framePrepareCalls.at(-1).options.maskScale, 1.1);

  harness.elements.shutterBtn.listeners.click();
  assert.equal(harness.liveDraws.at(-1).overlayScale, 0.8);
});
```

Update the cache-variant assertion in `caches normal and mobile prepared frame variants separately`:

```js
assert.deepEqual(
  harness.framePrepareCalls.map(call => call.options.maskScale),
  [1.1, 1]
);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test --test-name-pattern='balanced 80 percent|caches normal and mobile' tests/app.test.mjs
```

Expected: FAIL because `js/app.js` still supplies `maskScale: 1.25`; the assertion reports `1.25 !== 1.1` or the cache array contains `1.25`.

- [ ] **Step 3: Apply the minimal mobile profile change**

Change only the mobile mask value in `js/app.js`:

```js
const MOBILE_CAMERA_RENDERING_PROFILE = Object.freeze({
  overlayScale: 0.8,
  maskScale: 1.1
});
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
node --test --test-name-pattern='balanced 80 percent|caches normal and mobile' tests/app.test.mjs
```

Expected: the two selected tests pass and all non-matching tests are skipped.

- [ ] **Step 5: Run the complete automated verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, the static build command exits successfully, and `git diff --check` prints no errors.

- [ ] **Step 6: Verify the mobile preview boundary**

Run:

```bash
npm run dev
```

Open the local page at a viewport width of 480px or less. Confirm that the page has no horizontal overflow and that the frame picker, zoom controls, timer, and shutter layout are unchanged. If a real camera stream is available, compare a selected frame in the live preview and captured result and confirm both preserve more artwork around the face. If camera hardware is unavailable, report the live camera visual as unverified rather than inferring it from the tests.

- [ ] **Step 7: Commit the implementation**

Inspect `git status --short`, the complete diff for `js/app.js` and `tests/app.test.mjs`, and the cached diff before committing. Then run:

```bash
git add js/app.js tests/app.test.mjs
git commit -m "fix(camera): preserve more mobile frame artwork" \
  -m "Reduce the mobile face-mask compensation from 125% to 110% while keeping the existing 80% frame scale."
```
