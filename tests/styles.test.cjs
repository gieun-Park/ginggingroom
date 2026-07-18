const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const css = fs.readFileSync('css/styles.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const photoInputMarkup = html.match(/<input\b[^>]*\bid="photoInput"[^>]*>/)?.[0] ?? '';

test('places a horizontal frame rail above the shutter', () => {
    assert.match(html, /<main class="camera-app">[\s\S]*class="camera-stage"[\s\S]*id="frameGrid"[\s\S]*class="capture-controls"[\s\S]*id="shutterBtn"/);
    assert.doesNotMatch(html, /id="cameraBtn"/);
    assert.doesNotMatch(html, /class="(?:booth|photo-section|frame-section|frame-grid)"/);
});

test('keeps the 600 by 750 canvas inside a 4:5 camera stage', () => {
    assert.match(html, /<canvas id="canvas" width="600" height="750"><\/canvas>/);
    assert.match(css, /\.camera-stage\s*{[^}]*aspect-ratio:\s*4\s*\/\s*5/s);
    assert.match(css, /#canvas\s*{[^}]*display:\s*block[^}]*width:\s*100%[^}]*height:\s*100%/s);
});

test('provides accessible upload, shutter, timer, and countdown controls', () => {
    assert.match(html, /<label class="control-action upload-action">[\s\S]*<input type="file" id="photoInput" class="visually-hidden"[^>]*>[\s\S]*<\/label>/);
    assert.doesNotMatch(photoInputMarkup, /\shidden(?:\s|>)/);
    assert.match(css, /\.visually-hidden\s*{[^}]*position:\s*absolute[^}]*width:\s*1px[^}]*height:\s*1px[^}]*padding:\s*0[^}]*overflow:\s*hidden[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)[^}]*clip-path:\s*inset\(50%\)[^}]*white-space:\s*nowrap[^}]*border:\s*0/s);
    assert.match(html, /<button id="shutterBtn"[^>]*type="button"[^>]*aria-label="사진 촬영"/);
    assert.match(html, /<button id="timerBtn"[^>]*type="button"[^>]*aria-pressed="false"/);
    assert.match(html, /<button id="timerBtn"[^>]*aria-label="타이머: 끔"/);
    assert.match(html, /id="timerValue"[^>]*>끔</);
    assert.match(html, /id="countdown"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/);
});

test('provides an accessible hardware zoom group inside the camera stage', () => {
    assert.match(html, /class="camera-stage"[\s\S]*id="zoomControls"[^>]*role="group"[^>]*aria-label="카메라 배율"[^>]*hidden/);
    assert.match(html, /id="zoom05Btn"[^>]*aria-pressed="false"[^>]*>0\.5x</);
    assert.match(html, /id="zoom08Btn"[^>]*aria-pressed="false"[^>]*>0\.8x</);
    assert.match(html, /id="zoom1Btn"[^>]*aria-pressed="false"[^>]*>1x</);
});

test('keeps zoom controls touch-sized and camera status clear of the zoom pill', () => {
    assert.match(css, /\.camera-zoom\s*{[^}]*position:\s*absolute[^}]*left:\s*50%[^}]*bottom:\s*16px[^}]*display:\s*flex/s);
    assert.match(css, /\.zoom-btn\s*{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
    assert.match(css, /\.camera-status\s*{[^}]*top:\s*18px[^}]*bottom:\s*auto/s);
});

test('uses semantic hidden state for camera and review UI', () => {
    assert.match(html, /<video id="video"[^>]*muted[^>]*playsinline[^>]*hidden><\/video>/);
    assert.match(html, /id="retryDetectionBtn"[^>]*type="button"[^>]*hidden/);
    assert.match(html, /<section class="result-area" id="resultArea" hidden>/);
    assert.doesNotMatch(html, /style="[^"]*display:\s*none/);
    assert.match(css, /\.countdown\[hidden\]\s*{[^}]*display:\s*none/s);
    assert.match(css, /\.result-area:not\(\[hidden\]\)\s*{[^}]*display:\s*flex/s);
});

test('uses a horizontal frame rail with pressed selection and a circular shutter', () => {
    assert.match(css, /\.frame-rail\s*{[^}]*display:\s*flex[^}]*overflow-x:\s*auto[^}]*scroll-snap-type:\s*x\s+proximity/s);
    assert.match(css, /\.frame-item\s*{[^}]*flex:\s*0\s+0\s+76px[^}]*width:\s*76px[^}]*scroll-snap-align:\s*center/s);
    assert.match(css, /\.frame-item\s*{[^}]*padding:\s*0/s);
    assert.match(css, /\.frame-item\[aria-pressed="true"\]\s*{[^}]*border-color:\s*#c41e3a/s);
    assert.match(css, /\.shutter-btn\s*{[^}]*width:\s*76px[^}]*height:\s*76px[^}]*border-radius:\s*50%/s);
});

test('keeps interactive controls visibly focused', () => {
    assert.match(css, /:focus-visible\s*{[^}]*outline:\s*3px\s+solid\s+#c41e3a[^}]*outline-offset:\s*3px/s);
    assert.match(css, /\.upload-action:focus-within\s*{[^}]*outline:\s*3px\s+solid\s+#c41e3a/s);
});

test('fits mobile viewports without page overflow and respects reduced motion', () => {
    assert.match(css, /body\s*{[^}]*overflow-x:\s*hidden/s);
    assert.match(css, /\.camera-app\s*{[^}]*width:\s*min\(100%,\s*560px\)/s);
    assert.match(css, /@media\s*\(max-width:\s*480px\)\s*{[\s\S]*?body\s*{[^}]*padding:\s*0[^}]*}[\s\S]*?\.camera-card\s*{[^}]*border-radius:\s*0[^}]*padding:\s*12px/s);
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*?\*,\s*\*::before,\s*\*::after\s*{[^}]*animation-duration:\s*\.01ms\s*!important[^}]*transition-duration:\s*\.01ms\s*!important/s);
});
