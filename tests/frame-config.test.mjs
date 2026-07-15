import assert from 'node:assert/strict';
import test from 'node:test';
import { FRAMES } from '../js/frame-config.js';

function validAnchor(anchor) {
  return ['centerX', 'centerY', 'width', 'height']
    .every(key => Number.isFinite(anchor[key]) && anchor[key] > 0 && anchor[key] <= 1);
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
