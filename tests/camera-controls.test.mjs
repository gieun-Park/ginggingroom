import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCameraZoom,
  CAMERA_ZOOM_OPTIONS,
  getSupportedZoomOptions
} from '../js/camera-controls.js';

test('offers only candidate zoom values represented by the track range and step', () => {
  assert.deepEqual(CAMERA_ZOOM_OPTIONS, [0.5, 0.8, 1]);
  assert.deepEqual(
    getSupportedZoomOptions({ zoom: { min: 0.5, max: 1, step: 0.1 } }),
    [0.5, 0.8, 1]
  );
  assert.deepEqual(
    getSupportedZoomOptions({ zoom: { min: 0.5, max: 1, step: 0.25 } }),
    [0.5, 1]
  );
});

test('returns no zoom choices when capabilities are missing or malformed', () => {
  assert.deepEqual(getSupportedZoomOptions(), []);
  assert.deepEqual(getSupportedZoomOptions({}), []);
  assert.deepEqual(
    getSupportedZoomOptions({ zoom: { min: 1, max: 0.5, step: 0.1 } }),
    []
  );
});

test('accepts floating-point step values within tolerance', () => {
  assert.deepEqual(
    getSupportedZoomOptions(
      { zoom: { min: 0.5, max: 0.8, step: 0.1 } },
      [0.7000000000000001]
    ),
    [0.7000000000000001]
  );
});

test('applies zoom as an advanced video constraint', async () => {
  const calls = [];
  const track = {
    async applyConstraints(constraints) {
      calls.push(constraints);
    }
  };

  await applyCameraZoom(track, 0.8);

  assert.deepEqual(calls, [{ advanced: [{ zoom: 0.8 }] }]);
});

test('rejects when the active track cannot apply constraints', async () => {
  await assert.rejects(
    applyCameraZoom({}, 0.8),
    /카메라 배율을 변경할 수 없어요/
  );
});
