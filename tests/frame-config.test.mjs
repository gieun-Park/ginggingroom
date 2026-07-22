import assert from 'node:assert/strict';
import test from 'node:test';
import { FRAMES } from '../js/frame-config.js';

function validAnchor(anchor) {
  return ['centerX', 'centerY', 'width', 'height']
    .every(key => Number.isFinite(anchor[key]) && anchor[key] > 0 && anchor[key] <= 1);
}

function anchorFromBox(
  [left, top, right, bottom],
  [sourceWidth, sourceHeight] = [480, 480]
) {
  return {
    centerX: (left + right) / (sourceWidth * 2),
    centerY: (top + bottom) / (sourceHeight * 2),
    width: (right - left) / sourceWidth,
    height: (bottom - top) / sourceHeight
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
  assert.equal(FRAMES.length, 37);
  assert.equal(new Set(FRAMES.map(frame => frame.id)).size, 37);
  FRAMES.forEach(frame => {
    assert.match(frame.name, /^프레임 (?:[1-9]|[12]\d|3[0-7])$/, frame.id);
    assert.match(frame.src, /^assets\/frames\/frame_\d{2}\.png$/, frame.id);
    assert.equal(validAnchor(frame.faceAnchor), true, frame.id);
    if (frame.id === 'frame-33') assert.equal(frame.maskAnchors.length, 0);
    else assert.ok(frame.maskAnchors.length >= 1, frame.id);
    frame.maskAnchors.forEach(anchor => assert.equal(validAnchor(anchor), true, frame.id));
    assert.equal(frame.fitPadding, 1.08);
  });
  assert.deepEqual(
    FRAMES.map(frame => frame.src),
    Array.from({ length: 37 }, (_, index) => `assets/frames/frame_${String(index + 1).padStart(2, '0')}.png`)
  );
  assert.equal(new Set(FRAMES.map(frame => frame.src)).size, 37);
});

test('registers all frame ids in numeric order', () => {
  assert.deepEqual(
    FRAMES.map(frame => frame.id),
    Array.from({ length: 37 }, (_, index) => `frame-${index + 1}`)
  );
});

test('normalizes frame 33 against its portrait source dimensions', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-33');
  const screen = anchorFromBox([198, 660, 893, 1110], [1080, 1920]);

  assert.deepEqual(frame.faceAnchor, screen);
  assert.deepEqual(frame.maskAnchors, []);
  assert.deepEqual(frame.layout, {
    mode: 'contain',
    slots: [{ ...screen, shape: 'rect' }]
  });
});

test('orders the representative and secondary slots for multi-face frames', () => {
  const frame28 = FRAMES.find(({ id }) => id === 'frame-28');
  const frame29 = FRAMES.find(({ id }) => id === 'frame-29');

  assert.deepEqual(frame28.layout, {
    mode: 'anchored',
    slots: [
      { ...anchorFromBox([193, 119, 285, 211]), shape: 'ellipse' },
      { ...anchorFromBox([193, 23, 281, 105]), shape: 'ellipse' },
      { ...anchorFromBox([197, 216, 286, 307]), shape: 'ellipse' }
    ]
  });
  assert.deepEqual(frame29.layout, {
    mode: 'anchored',
    slots: [
      { ...anchorFromBox([159, 148, 294, 245]), shape: 'ellipse' },
      { ...anchorFromBox([105, 300, 199, 366]), shape: 'ellipse' },
      { ...anchorFromBox([270, 316, 355, 391]), shape: 'ellipse' }
    ]
  });
});

test('normalizes non-square costume frames against their native dimensions', () => {
  const frame34 = FRAMES.find(({ id }) => id === 'frame-34');
  const frame37 = FRAMES.find(({ id }) => id === 'frame-37');

  assert.deepEqual(frame34.faceAnchor, anchorFromBox([58, 173, 157, 248], [216, 350]));
  assert.deepEqual(frame37.faceAnchor, anchorFromBox([46, 150, 156, 229], [217, 340]));
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
