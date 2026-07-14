import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FACE_OVAL_INDICES,
  getCoverTransform,
  isPlacementVisible,
  landmarksToPlacement,
  mapPlacementToCanvas,
  sortPlacementsForDrawing
} from '../js/face-geometry.js';

function makeLandmarks({ left = 0.3, right = 0.7, top = 0.2, bottom = 0.8, eyeRise = 0 }) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  FACE_OVAL_INDICES.forEach((index, position) => {
    const angle = (Math.PI * 2 * position) / FACE_OVAL_INDICES.length;
    landmarks[index] = {
      x: (left + right) / 2 + Math.cos(angle) * (right - left) / 2,
      y: (top + bottom) / 2 + Math.sin(angle) * (bottom - top) / 2,
      z: 0
    };
  });
  landmarks[33] = { x: 0.4, y: 0.4, z: 0 };
  landmarks[263] = { x: 0.6, y: 0.4 + eyeRise, z: 0 };
  return landmarks;
}

test('derives normalized center, bounds, and eye-line rotation', () => {
  const placement = landmarksToPlacement(makeLandmarks({ eyeRise: 0.1 }));
  assert.ok(Math.abs(placement.centerX - 0.5) < 0.001);
  assert.ok(Math.abs(placement.centerY - 0.5) < 0.001);
  assert.ok(Math.abs(placement.width - 0.4) < 0.001);
  assert.ok(Math.abs(placement.height - 0.6) < 0.001);
  assert.ok(Math.abs(placement.rotation - Math.atan2(0.1, 0.2)) < 0.001);
});

test('returns null for incomplete landmarks', () => {
  assert.equal(landmarksToPlacement([{ x: 0.5, y: 0.5 }]), null);
});

test('maps placements through the same cover transform used by the photo', () => {
  assert.deepEqual(getCoverTransform({ width: 1000, height: 500 }, { width: 400, height: 500 }), {
    scale: 1,
    offsetX: -300,
    offsetY: 0
  });
  assert.deepEqual(
    mapPlacementToCanvas(
      { centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.4, rotation: 0 },
      { width: 1000, height: 500 },
      { width: 400, height: 500 }
    ),
    { centerX: 200, centerY: 250, width: 200, height: 200, rotation: 0 }
  );
});

test('converts normalized rotation to image-pixel angle for non-square images', () => {
  const normalizedRotation = Math.PI / 4;
  const placement = mapPlacementToCanvas(
    { centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.4, rotation: normalizedRotation },
    { width: 1000, height: 500 },
    { width: 400, height: 500 }
  );
  const expectedRotation = Math.atan2(
    Math.sin(normalizedRotation) * 500,
    Math.cos(normalizedRotation) * 1000
  );

  assert.ok(Math.abs(placement.rotation - expectedRotation) < 0.001);
});

test('filters cropped faces and sorts larger faces before smaller faces', () => {
  assert.equal(isPlacementVisible({ centerX: -1, centerY: 20 }, { width: 400, height: 500 }), false);
  assert.equal(isPlacementVisible({ centerX: 20, centerY: 20 }, { width: 400, height: 500 }), true);
  assert.deepEqual(
    sortPlacementsForDrawing([
      { id: 'small', width: 20, height: 20 },
      { id: 'large', width: 40, height: 30 }
    ]).map(({ id }) => id),
    ['large', 'small']
  );
});
