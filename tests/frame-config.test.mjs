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
    assert.equal(validAnchor(frame.faceAnchor), true, frame.id);
    assert.ok(frame.maskAnchors.length >= 1, frame.id);
    frame.maskAnchors.forEach(anchor => assert.equal(validAnchor(anchor), true, frame.id));
    assert.equal(frame.fitPadding, 1.08);
  });
});

test('normalizes both face placeholders in frame 25', () => {
  const frame = FRAMES.find(({ id }) => id === 'frame-25');
  assert.equal(frame.maskAnchors.length, 2);
});
