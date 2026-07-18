import assert from 'node:assert/strict';
import test from 'node:test';
import { FRAMES } from '../js/frame-config.js';

function validAnchor(anchor) {
  return ['centerX', 'centerY', 'width', 'height']
    .every(key => Number.isFinite(anchor[key]) && anchor[key] > 0 && anchor[key] <= 1);
}

function anchorFromBox([left, top, right, bottom]) {
  return {
    centerX: (left + right) / 960,
    centerY: (top + bottom) / 960,
    width: (right - left) / 480,
    height: (bottom - top) / 480
  };
}

function boundsFromBox([left, top, right, bottom]) {
  return {
    left: left / 480,
    top: top / 480,
    right: right / 480,
    bottom: bottom / 480
  };
}

test('calibrates every existing frame with normalized face and mask anchors', () => {
  assert.equal(FRAMES.length, 26);
  assert.equal(new Set(FRAMES.map(frame => frame.id)).size, 26);
  FRAMES.forEach(frame => {
    assert.match(frame.name, /^프레임 (?:[1-9]|1\d|2[0-6])$/, frame.id);
    assert.match(frame.src, /^assets\/frames\/frame_\d{2}\.png$/, frame.id);
    assert.equal(validAnchor(frame.faceAnchor), true, frame.id);
    assert.ok(frame.maskAnchors.length >= 1, frame.id);
    frame.maskAnchors.forEach(anchor => assert.equal(validAnchor(anchor), true, frame.id));
    assert.equal(frame.fitPadding, 1.08);
  });
  assert.deepEqual(
    FRAMES.map(frame => frame.src),
    Array.from({ length: 26 }, (_, index) => `assets/frames/frame_${String(index + 1).padStart(2, '0')}.png`)
  );
  assert.equal(new Set(FRAMES.map(frame => frame.src)).size, 26);
});

test('normalizes both face placeholders in frame 25', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-25');
  assert.equal(frame.maskAnchors.length, 2);
  assert.deepEqual(frame.faceAnchor, frame.maskAnchors[0]);
});

test('calibrates frame 22 erase mask without changing its fit anchor', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-22');
  assert.deepEqual(frame.faceAnchor, anchorFromBox([210, 178, 263, 242]));
  assert.deepEqual(frame.maskAnchors, [anchorFromBox([213, 193, 263, 242])]);
  assert.equal(frame.mobileMaskScale, 1);
});

test('marks frame 25 as a paired single-face layout', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-25');
  assert.deepEqual(frame.layout, {
    mode: 'paired',
    contentBounds: boundsFromBox([88, 152, 393, 328]),
    viewportPadding: 0.04,
    scaleMode: 'face'
  });
  assert.equal(frame.layout.portraitInset, undefined);
  assert.equal(frame.maskAnchors.length, 2);
});

test('keeps frame-specific rendering metadata opt-in', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-1');
  assert.equal(frame.mobileMaskScale, undefined);
  assert.equal(frame.layout, undefined);
});
